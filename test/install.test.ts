/**
 * /install, geenee's stable install address (ADR 0005): a redirect to the
 * Marketplace install page in aidenlab/plugins. /get, the old address that
 * Hand-off emails already sent contain, does the same.
 */
import { describe, expect, it } from 'vitest'
import { GEENEE, geenee } from './connector.ts'

const visit = (path: string, method = 'GET') => geenee().handle(new Request(`${GEENEE}${path}`, { method }))

describe('the install address', () => {
  for (const path of ['/install', '/get', '/get?room=7ZQH4M2K9X']) {
    it(`redirects ${path} to the Marketplace install page`, async () => {
      const response = await visit(path)

      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toBe('https://geenee-install.3dg.io/install')
    })
  }

  it('answers a HEAD, as a link checker or a link preview asks, with the same redirect', async () => {
    const response = await visit('/install', 'HEAD')

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('https://geenee-install.3dg.io/install')
    expect(response.body).toBeNull()
  })
})
