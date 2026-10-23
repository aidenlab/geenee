const CROCKFORD_BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const ROOM_ID = /^[0-9A-HJKMNP-TV-Z]{10}$/

/**
 * A Room id: 10 Crockford base32 characters (about 50 bits), the shape both
 * Upstreams give theirs, so that one id names a Room in each.
 */
export function mintRoomId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => CROCKFORD_BASE32[b & 31]).join('')
}

/** The path of the Room link to a Room: the short link that brings anyone into it. */
export function roomLinkPath(room: string): string {
  return `/r/${room}`
}

/** Whatever stands for the Room id in a Room link's path, `/r/<Room id>`, unchecked; null when `pathname` is not a Room link's. */
export function inRoomLinkPath(pathname: string): string | null {
  return pathname.match(/^\/r\/([^/]*)\/?$/)?.[1] ?? null
}

/** The Room id in `value` as a model or person may give it, lower case or with spaces around it; null if it is not one. */
export function parseRoomId(value: string): string | null {
  const roomId = value.trim().toUpperCase()
  return ROOM_ID.test(roomId) ? roomId : null
}
