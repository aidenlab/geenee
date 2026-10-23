/**
 * A QR code of a link as a base64 PNG, for the Card. Copied from the Juicebox
 * Upstream's qrPng.js: pure JS, so it runs in the Worker without canvas.
 */
import QRCode from 'qrcode'

const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[n] = c
}

function crc32(buf: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff
  for (let i = start; i < end; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function write32(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = (value >>> 24) & 0xff
  buf[offset + 1] = (value >>> 16) & 0xff
  buf[offset + 2] = (value >>> 8) & 0xff
  buf[offset + 3] = value & 0xff
}

function write16LE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff
  buf[offset + 1] = (value >>> 8) & 0xff
}

/** length(4) + type(4) + data + crc(4) */
function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(4 + 4 + data.length + 4)
  write32(chunk, 0, data.length)
  for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i)
  chunk.set(data, 8)
  write32(chunk, 8 + data.length, crc32(chunk, 4, 8 + data.length))
  return chunk
}

function adler32(buf: Uint8Array): number {
  let a = 1
  let b = 0
  for (let i = 0; i < buf.length; i++) {
    a = (a + buf[i]) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

/** Raw data in a zlib container of stored (uncompressed) deflate blocks. */
function zlibStored(raw: Uint8Array): Uint8Array {
  const maxBlock = 65535
  const numBlocks = Math.ceil(raw.length / maxBlock) || 1
  const out = new Uint8Array(2 + numBlocks * 5 + raw.length + 4)
  let p = 0
  out[p++] = 0x78 // CMF
  out[p++] = 0x01 // FLG
  let offset = 0
  while (offset < raw.length) {
    const blockLen = Math.min(raw.length - offset, maxBlock)
    out[p++] = offset + blockLen === raw.length ? 0x01 : 0x00
    write16LE(out, p, blockLen)
    write16LE(out, p + 2, blockLen ^ 0xffff)
    p += 4
    out.set(raw.subarray(offset, offset + blockLen), p)
    p += blockLen
    offset += blockLen
  }
  write32(out, p, adler32(raw))
  return out
}

/** A QR code of `text` as base64 PNG data (no data: prefix), `scale` pixels per module. */
export function qrPng(text: string, scale = 8): string {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const size = qr.modules.size
  const data = qr.modules.data
  const margin = scale // a one-module margin
  const imgSize = size * scale + margin * 2

  // 1-bit indexed scanlines, each led by a filter byte of 0 (None); palette 0 is white, 1 black.
  const rowBytes = Math.ceil(imgSize / 8)
  const scanlines = new Uint8Array(imgSize * (1 + rowBytes))
  for (let py = 0; py < imgSize; py++) {
    const rowOffset = py * (1 + rowBytes)
    for (let px = 0; px < imgSize; px++) {
      const mx = Math.floor((px - margin) / scale)
      const my = Math.floor((py - margin) / scale)
      if (mx >= 0 && mx < size && my >= 0 && my < size && data[my * size + mx]) {
        scanlines[rowOffset + 1 + (px >> 3)] |= 0x80 >> (px & 7)
      }
    }
  }

  const ihdr = new Uint8Array(13)
  write32(ihdr, 0, imgSize) // width
  write32(ihdr, 4, imgSize) // height
  ihdr[8] = 1 // bit depth
  ihdr[9] = 3 // color type: indexed
  const chunks = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('PLTE', new Uint8Array([255, 255, 255, 0, 0, 0])),
    pngChunk('IDAT', zlibStored(scanlines)),
    pngChunk('IEND', new Uint8Array(0)),
  ]
  const png = new Uint8Array(chunks.reduce((length, chunk) => length + chunk.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    png.set(chunk, offset)
    offset += chunk.length
  }

  let binary = ''
  for (let i = 0; i < png.length; i++) binary += String.fromCharCode(png[i])
  return btoa(binary)
}
