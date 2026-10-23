/**
 * A Room expires after a day without use, and an expired Room stays expired
 * (ADR 0003). The clock is the stand-in's, moved on by hand.
 */
import { describe, expect, it } from 'vitest'
import { GEENEE, geenee, WORKSPACE_PAGE } from './connector.ts'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

type JoinLinks = Record<'igv' | 'juicebox', string | null>

/** A geenee with a Room just opened by open_geenee, and that Room's id. */
async function withRoom() {
  const connector = geenee()
  const opened = await connector.callTool('open_geenee')
  return { ...connector, room: opened.structuredContent!.room as string }
}

describe('a tool call', () => {
  it('for a Room used within the day is forwarded', async () => {
    const { callTool, clock, igv, room } = await withRoom()
    clock.advance(DAY - HOUR)

    const result = await callTool('igv_zoom_in', { room })

    expect(result).toEqual({ content: [{ type: 'text', text: 'Done.' }] })
    expect(igv.calls).toHaveLength(1)
  })

  it('for a Room a day without use tells the model it has expired and to open geenee again, and is not sent', async () => {
    const { callTool, clock, igv, room } = await withRoom()
    clock.advance(DAY)

    const result = await callTool('igv_zoom_in', { room })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe(
      `Error: Room ${room} has expired, so igv_zoom_in was not sent. Call open_geenee without room to open geenee in a new Room, then make this call again with the new Room id.`,
    )
    expect(igv.calls).toEqual([])
  })
})

describe('a Room', () => {
  it('lives on a day from its last use', async () => {
    const { callTool, clock, juicebox, room } = await withRoom()
    clock.advance(DAY - HOUR)
    await callTool('juicebox_zoom_in', { room })
    clock.advance(DAY - HOUR)

    const result = await callTool('juicebox_zoom_out', { room })

    expect(result.isError).toBeFalsy()
    expect(juicebox.calls).toHaveLength(2)
  })

  it('once expired, is not opened again by open_geenee, and stays expired', async () => {
    const { callTool, clock, room } = await withRoom()
    clock.advance(DAY)

    const reopened = await callTool('open_geenee', { room })
    const later = await callTool('igv_zoom_in', { room })

    expect(reopened.isError).toBe(true)
    expect(reopened.content[0].text).toBe(`Error: Room ${room} has expired. Call open_geenee without room to open geenee in a new Room.`)
    expect(reopened.structuredContent).toBeUndefined()
    expect(later.content[0].text).toContain(`Room ${room} has expired`)
  })

  it('that geenee never opened is as good as expired', async () => {
    const { callTool, igv } = geenee()

    const result = await callTool('igv_zoom_in', { room: '7ZQH4M2K9X' })

    expect(result.content[0].text).toContain('Room 7ZQH4M2K9X has expired')
    expect(igv.calls).toEqual([])
  })

  it('expired tells no Workspace that a Viewer was used', async () => {
    const { callTool, clock, openWorkspace, room } = await withRoom()
    const workspace = await openWorkspace(room)
    clock.advance(DAY)

    await callTool('juicebox_zoom_in', { room })

    expect(workspace.told).toEqual([])
  })

  it('opened again by open_geenee within the day lives on a day from then', async () => {
    const { callTool, clock, room } = await withRoom()
    clock.advance(DAY - HOUR)
    const reopened = await callTool('open_geenee', { room })
    clock.advance(DAY - HOUR)

    const result = await callTool('igv_zoom_in', { room })

    expect(reopened.structuredContent!.room).toBe(room)
    expect(result.isError).toBeFalsy()
  })
})

describe("an expired Room's link", () => {
  for (const [where, path] of [
    ['on a computer', 'r'],
    ['on a phone, at the Hand-off', 'h'],
  ]) {
    it(`${where}, shows that the Room has expired, and the way to get geenee`, async () => {
      const { handle, clock, room } = await withRoom()
      clock.advance(DAY)

      const response = await handle(new Request(`${GEENEE}/${path}/${room}`))

      expect(response.status).toBe(410)
      expect(response.headers.get('Content-Type')).toContain('text/html')
      const page = await response.text()
      expect(page).toContain('<title>This geenee Room has expired</title>')
      expect(page).toContain('<h1>This Room has expired</h1>')
      expect(page).toContain('<a class="button" href="/get">Get geenee</a>')
    })
  }

  it('is no use of the Room: a Room that has not expired opens as before', async () => {
    const { handle, room } = await withRoom()

    const workspace = await handle(new Request(`${GEENEE}/r/${room}`))
    const handOff = await handle(new Request(`${GEENEE}/h/${room}`))

    expect(await workspace.text()).toBe(WORKSPACE_PAGE)
    expect(await handOff.text()).toContain('Send this link to your computer')
  })
})

describe('the Workspace of a Room', () => {
  const ask = (handle: (request: Request) => Promise<Response>, what: 'viewers' | 'connections', room: string) =>
    handle(new Request(`${GEENEE}/${what}?room=${room}`))

  /** A Room whose Upstreams give a Join link for it. */
  async function withJoinLinks() {
    const connector = await withRoom()
    connector.igv.reply = (call) => ({ content: [], structuredContent: { joinUrl: `https://igv-viewer.test/?room=${call.arguments.room}` } })
    connector.juicebox.reply = (call) => ({ content: [], structuredContent: { joinUrl: `https://juicebox-viewer.test/?room=${call.session}` } })
    return connector
  }

  for (const what of ['viewers', 'connections'] as const) {
    it(`asking /${what} for an expired Room is told it has expired, and nothing is asked of the Upstreams`, async () => {
      const { handle, clock, igv, juicebox, room } = await withRoom()
      clock.advance(DAY)

      const response = await ask(handle, what, room)

      expect(response.status).toBe(410)
      expect(igv.calls).toEqual([])
      expect(juicebox.calls).toEqual([])
    })

    it(`asking /${what} is a use of the Room`, async () => {
      const { handle, callTool, clock, room } = await withRoom()
      clock.advance(DAY - HOUR)
      await ask(handle, what, room)
      clock.advance(DAY - HOUR)

      const result = await callTool('igv_zoom_in', { room })

      expect(result.isError).toBeFalsy()
    })
  }

  it("asks each Upstream for its Viewer's Join link once, so that opening it again never revives an expired igv Room", async () => {
    const { handle, clock, igv, juicebox, room } = await withJoinLinks()
    await ask(handle, 'viewers', room)
    clock.advance(DAY - HOUR)

    const again = await ask(handle, 'viewers', room)

    expect(await again.json()).toEqual({ igv: `https://igv-viewer.test/?room=${room}`, juicebox: `https://juicebox-viewer.test/?room=${room}` })
    expect(igv.calls.map((call) => call.name)).toEqual(['open_viewer'])
    expect(juicebox.calls.map((call) => call.name)).toEqual(['get_juicebox_url'])
  })

  it('asks again for a Join link its Upstream did not give', async () => {
    const { handle, igv, room } = await withJoinLinks()
    igv.unreachable = true
    const first = await ask(handle, 'viewers', room)
    igv.unreachable = false

    const again = await ask(handle, 'viewers', room)

    expect(((await first.json()) as JoinLinks).igv).toBeNull()
    expect(((await again.json()) as JoinLinks).igv).toBe(`https://igv-viewer.test/?room=${room}`)
  })
})
