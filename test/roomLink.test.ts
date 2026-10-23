/**
 * The Room link, /r/<Room id>: the short link that brings anyone into a Room.
 */
import { describe, expect, it } from 'vitest'
import { GEENEE, geenee, WORKSPACE_PAGE } from './connector.ts'

const visit = (path: string) => geenee({ opened: ['7ZQH4M2K9X'] }).handle(new Request(`${GEENEE}${path}`))

describe('a Room link', () => {
  it('opens the Workspace, at the short link itself', async () => {
    const response = await visit('/r/7ZQH4M2K9X')

    expect(response.status).toBe(200)
    expect(await response.text()).toBe(WORKSPACE_PAGE)
  })

  it('takes a Room id typed in lower case', async () => {
    const response = await visit('/r/7zqh4m2k9x')

    expect(await response.text()).toBe(WORKSPACE_PAGE)
  })

  it('with a malformed Room id, gets a page saying so', async () => {
    const response = await visit('/r/not-a-room')

    expect(response.status).toBe(404)
    expect(response.headers.get('Content-Type')).toContain('text/html')
    const page = await response.text()
    expect(page).toContain('<title>No such geenee Room</title>')
    expect(page).toContain('This link does not name a geenee Room')
    expect(page).not.toContain('not-a-room') // nothing from the address is echoed into the page
  })

  it('with a broken escape in the Room id, gets the same page', async () => {
    const response = await visit('/r/%E0%A4%A')

    expect(response.status).toBe(404)
  })

  it('with no Room id, gets the same page', async () => {
    const response = await visit('/r/')

    expect(response.status).toBe(404)
    expect(await response.text()).toContain('This link does not name a geenee Room')
  })
})
