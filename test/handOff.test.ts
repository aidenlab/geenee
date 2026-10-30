/**
 * The Hand-off, /h/<Room id>: where a Room link opened on a phone goes, so that
 * a Guest sends the Room link on to a computer.
 */
import { describe, expect, it } from 'vitest'
import { GEENEE, geenee } from './connector.ts'

const visit = (path: string) => geenee({ opened: ['7ZQH4M2K9X'] }).handle(new Request(`${GEENEE}${path}`))
const handOff = async (room = '7ZQH4M2K9X') => (await visit(`/h/${room}`)).text()

describe('the Hand-off', () => {
  it('is served as a page for a Room id, typed in any case', async () => {
    const response = await visit('/h/7zqh4m2k9x')

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/html')
    expect(await response.text()).toContain('https://geenee.test/r/7ZQH4M2K9X')
  })

  it('says the Room is built for a laptop or desktop, and when it expires', async () => {
    const page = await handOff()

    expect(page).toContain("You've been invited to a live geenee Room. It's built for a laptop or desktop.")
    expect(page).toContain('Expires after a day without use.')
    expect(page).not.toContain('24 hours')
  })

  it('emails the Room link to no one in particular, with the expiry and the way to get geenee', async () => {
    const page = await handOff()
    // The href as a browser reads it, with its character references decoded.
    const mailto = page.match(/href="(mailto:[^"]*)"/)?.[1].replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))

    expect(mailto).toBeDefined()
    const email = new URL(mailto!)
    expect(email.pathname).toBe('')
    expect(email.searchParams.get('subject')).toBe('Your geenee Room')
    const body = email.searchParams.get('body')!
    expect(body).toContain('https://geenee.test/r/7ZQH4M2K9X')
    expect(body).toContain('Expires after a day without use.')
    expect(body).toContain('https://geenee.test/get')
  })

  it('offers to share and to copy the Room link', async () => {
    const page = await handOff()

    expect(page).toContain('Share…')
    expect(page).toContain('Copy link')
  })

  it('opens the Workspace here anyway, and leads to Get geenee', async () => {
    const page = await handOff()

    expect(page).toContain('href="/?room=7ZQH4M2K9X"')
    expect(page).toContain('href="/get?room=7ZQH4M2K9X"')
    expect(page).toContain('Get geenee for your own Claude or ChatGPT →')
  })

  it('switches to Get geenee at the top of the page, and is the page it is on', async () => {
    const page = await handOff()

    expect(page).toContain('<span aria-current="page">Your Room</span>')
    expect(page).toContain('<a href="/get?room=7ZQH4M2K9X">Get geenee</a>')
  })

  it('with a malformed Room id, gets the page saying so', async () => {
    const response = await visit('/h/not-a-room')

    expect(response.status).toBe(404)
    expect(await response.text()).toContain('This link does not name a geenee Room')
  })
})
