/**
 * Whether a page is on a phone, where a Room link shows the Hand-off (#23)
 * instead of the Workspace. Decided in the browser by pointer and screen size,
 * never by user agent: a coarse pointer on a screen whose shorter side is at
 * most the cut-off, so that a phone held either way is one and a tablet is a
 * computer.
 */

/** The one cut-off, in CSS pixels: phones are about 430 across, the smallest tablets about 740. */
const PHONE_MAX_SHORTER_SIDE_PX = 600

const PHONE = `(pointer: coarse) and (max-width: ${PHONE_MAX_SHORTER_SIDE_PX}px), (pointer: coarse) and (max-height: ${PHONE_MAX_SHORTER_SIDE_PX}px)`

export function onPhone(): boolean {
  return matchMedia(PHONE).matches
}
