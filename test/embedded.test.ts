/**
 * The link the Workspace frames a Viewer at: its Join link marked `embedded`,
 * so that the Viewer leaves out what the Workspace supplies.
 */
import { describe, expect, it } from 'vitest'
import { embedded } from '../src/workspace/embedded.ts'

describe('the link a Viewer is framed at', () => {
  it('is the Join link with embedded added, keeping its room', () => {
    expect(embedded('https://igv-viewer.test/?room=7ZQH4M2K9X')).toBe('https://igv-viewer.test/?room=7ZQH4M2K9X&embedded')
    expect(embedded('https://juicebox-viewer.test/?room=7ZQH4M2K9X')).toBe(
      'https://juicebox-viewer.test/?room=7ZQH4M2K9X&embedded',
    )
  })

  it('is the Join link with embedded as its only parameter when it has none', () => {
    expect(embedded('https://igv-viewer.test/')).toBe('https://igv-viewer.test/?embedded')
  })
})
