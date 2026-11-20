/**
 * The QR address of a Room, /r/<Room id>/qr.png: the QR code of its Room link,
 * for Hosts that draw no Card and show it as an image in the reply.
 */
import { describe, expect, it } from 'vitest'
import { qrPng } from '../src/qrPng.ts'
import { GEENEE, geenee } from './connector.ts'

const DAY = 24 * 60 * 60 * 1000

describe('the QR address of a Room', () => {
  it('serves the PNG of the Room link, cached a short while', async () => {
    const response = await geenee({ opened: ['7ZQH4M2K9X'] }).handle(new Request(`${GEENEE}/r/7zqh4m2k9x/qr.png`))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/png')
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=300')
    const png = new Uint8Array(await response.arrayBuffer())
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(btoa(String.fromCharCode(...png))).toBe(qrPng(`${GEENEE}/r/7ZQH4M2K9X`)) // the image the Card draws
  })

  it('is not found for a Room that has expired', async () => {
    const { clock, handle } = geenee({ opened: ['7ZQH4M2K9X'] })
    clock.advance(DAY)

    const response = await handle(new Request(`${GEENEE}/r/7ZQH4M2K9X/qr.png`))

    expect(response.status).toBe(404)
  })

  it('is not found for a Room geenee never opened, nor for a malformed Room id', async () => {
    const { handle } = geenee()

    expect((await handle(new Request(`${GEENEE}/r/7ZQH4M2K9X/qr.png`))).status).toBe(404)
    expect((await handle(new Request(`${GEENEE}/r/not-a-room/qr.png`))).status).toBe(404)
  })
})
