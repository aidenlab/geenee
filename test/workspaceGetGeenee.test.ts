/**
 * The Workspace's quiet "Get geenee" line: shown when it was opened by a Room
 * link, /r/<Room id>, which is how a Guest arrives, and not by /?room=<Room id>,
 * the Organizer's link from the Card.
 */
import { describe, expect, it } from 'vitest'
import { offersGetGeenee } from '../src/workspace/getGeenee.ts'

describe("the Workspace's Get geenee line", () => {
  it('is shown when the Workspace was opened by a Room link', () => {
    expect(offersGetGeenee('/r/7ZQH4M2K9X')).toBe(true)
    expect(offersGetGeenee('/r/7zqh4m2k9x/')).toBe(true)
  })

  it("is not shown when it was opened by the Organizer's /?room= link", () => {
    expect(offersGetGeenee('/')).toBe(false)
  })

  it('is not shown for a malformed Room link', () => {
    expect(offersGetGeenee('/r/not-a-room')).toBe(false)
  })
})
