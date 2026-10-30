/**
 * Get geenee, /get: what geenee is and how to add it as a Connector to each Host.
 */
import { describe, expect, it } from 'vitest'
import { GEENEE, geenee } from './connector.ts'

const visit = (path: string) => geenee().handle(new Request(`${GEENEE}${path}`))

describe('the Get geenee page', () => {
  it('is served as a page at /get', async () => {
    const response = await visit('/get')

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/html')
    expect(await response.text()).toContain('<title>Get geenee</title>')
  })

  it('gives the Connector address of the geenee that serves it', async () => {
    const page = await (await visit('/get')).text()

    expect(page).toContain('https://geenee.test/mcp')
  })

  it('says where to add the Connector in Claude and in ChatGPT', async () => {
    const page = await (await visit('/get')).text()

    expect(page).toContain('Settings → Connectors → Add custom connector')
    expect(page).toContain('Settings → Plugins → Add → Add MCP server')
    expect(page).toContain('Streamable HTTP')
  })

  it('leads back to the Room of the Hand-off a Guest came from, its id in any case', async () => {
    const page = await (await visit('/get?room=7zqh4m2k9x')).text()

    expect(page).toContain('<a href="/h/7ZQH4M2K9X">Your Room</a>')
    expect(page).toContain('<span aria-current="page">Get geenee</span>')
  })

  for (const path of ['/get', '/get?room=', '/get?room=not-a-room', '/get?room=%22%3E%3Cscript%3E']) {
    it(`has no way back to a Room at ${path}`, async () => {
      const page = await (await visit(path)).text()

      expect(page).toContain('<p class="brand">geenee</p>')
      expect(page).not.toContain('<nav')
      expect(page).not.toContain('Your Room')
    })
  }
})
