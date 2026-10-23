/**
 * Get geenee, /get: what geenee is and how to add it as a Connector to each Host.
 */
import { describe, expect, it } from 'vitest'
import { GEENEE, geenee } from './connector.ts'

const visit = (path: string, init?: RequestInit) => geenee().handle(new Request(`${GEENEE}${path}`, init))

describe('the Get geenee page', () => {
  it('is a page', async () => {
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
})
