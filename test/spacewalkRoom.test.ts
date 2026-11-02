/**
 * Spacewalk's Room has a real opened state: its Upstream refuses every tool but
 * open_viewer for a Room it never opened. So open_geenee opens it there, and
 * opens it again when Spacewalk's Room has expired under a live geenee Room.
 */
import { describe, expect, it } from 'vitest'
import { GEENEE, geenee } from './connector.ts'
import type { UpstreamCall, UpstreamReply } from './upstreams.ts'

const DAY_MS = 24 * 60 * 60 * 1000

/** A stand-in Spacewalk Upstream that, like the real one, refuses every tool but open_viewer for a Room it has not opened. */
function withSpacewalkRooms(connector: ReturnType<typeof geenee>) {
  const open = new Set<string>()
  connector.spacewalk.reply = (call: UpstreamCall): UpstreamReply => {
    const room = call.arguments.room as string
    if (call.name === 'open_viewer') {
      open.add(room)
      return {
        content: [{ type: 'text', text: 'Spacewalk Room link' }],
        structuredContent: { room, roomLink: `https://spacewalk-viewer.test/?room=${room}` },
      }
    }
    if (!open.has(room)) return { content: [{ type: 'text', text: `Error: Room ${room} is not open. Call open_viewer first.` }], isError: true }
    if (call.name === 'read_viewer_count') return { content: [{ type: 'text', text: 'Viewers connected: 0.' }], structuredContent: { viewers: 0 } }
    return { content: [{ type: 'text', text: 'Done.' }] }
  }
  return { ...connector, spacewalkRooms: open }
}

const names = (calls: UpstreamCall[]) => calls.map((call) => call.name)

describe('a new open_geenee', () => {
  it("opens Spacewalk's Room once, and GET /viewers does not ask again", async () => {
    const { callTool, handle, spacewalk } = withSpacewalkRooms(geenee())

    const room = (await callTool('open_geenee')).structuredContent!.room as string
    expect(spacewalk.calls).toEqual([{ name: 'open_viewer', arguments: { room }, session: null }])
    const response = await handle(new Request(`${GEENEE}/viewers?room=${room}`))

    expect(spacewalk.calls).toHaveLength(1)
    expect(((await response.json()) as { spacewalk: unknown }).spacewalk).toBe(`https://spacewalk-viewer.test/?room=${room}`)
  })

  it('still asks nothing of the igv and Juicebox Upstreams', async () => {
    const { callTool, igv, juicebox } = withSpacewalkRooms(geenee())

    await callTool('open_geenee')

    expect(igv.calls).toEqual([])
    expect(juicebox.calls).toEqual([])
  })

  it('lets a Spacewalk tool call straight after it reach an open Room', async () => {
    const { callTool } = withSpacewalkRooms(geenee())

    const room = (await callTool('open_geenee')).structuredContent!.room as string
    const result = await callTool('spacewalk_load_ensemble', { url: 'https://example.test/trace.sw', room })

    expect(result).toEqual({ content: [{ type: 'text', text: 'Done.' }] })
  })
})

describe('with the Spacewalk Upstream unreachable', () => {
  it('open_geenee still opens geenee', async () => {
    const { callTool, spacewalk } = withSpacewalkRooms(geenee())
    spacewalk.unreachable = true

    const result = await callTool('open_geenee')

    expect(result.isError).toBeFalsy()
    expect(result.structuredContent!.room).toBeTypeOf('string')
  })

  it("the next Spacewalk tool call opens Spacewalk's Room, and reaches it", async () => {
    const { callTool, spacewalk } = withSpacewalkRooms(geenee())
    spacewalk.unreachable = true
    const room = (await callTool('open_geenee')).structuredContent!.room as string
    spacewalk.unreachable = false

    const result = await callTool('spacewalk_reset_camera', { room })
    await callTool('spacewalk_reset_camera', { room })

    expect(result).toEqual({ content: [{ type: 'text', text: 'Done.' }] })
    expect(names(spacewalk.calls)).toEqual(['open_viewer', 'reset_camera', 'reset_camera'])
  })

  it("GET /viewers opens Spacewalk's Room once it can be reached", async () => {
    const { callTool, handle, spacewalk } = withSpacewalkRooms(geenee())
    spacewalk.unreachable = true
    const room = (await callTool('open_geenee')).structuredContent!.room as string
    spacewalk.unreachable = false

    const response = await handle(new Request(`${GEENEE}/viewers?room=${room}`))

    expect(((await response.json()) as { spacewalk: unknown }).spacewalk).toBe(`https://spacewalk-viewer.test/?room=${room}`)
    expect(names(spacewalk.calls)).toEqual(['open_viewer'])
  })
})

describe('open_geenee given a Room that is still open', () => {
  it("does not open Spacewalk's Room again while it is live", async () => {
    const { callTool, spacewalk } = withSpacewalkRooms(geenee())
    const room = (await callTool('open_geenee')).structuredContent!.room as string
    spacewalk.calls.length = 0

    const result = await callTool('open_geenee', { room })

    expect(result.isError).toBeFalsy()
    expect(spacewalk.calls).toEqual([{ name: 'read_viewer_count', arguments: { room }, session: null }])
  })

  it("opens Spacewalk's Room again when Spacewalk's has expired", async () => {
    const { callTool, spacewalk, spacewalkRooms } = withSpacewalkRooms(geenee())
    const room = (await callTool('open_geenee')).structuredContent!.room as string
    spacewalkRooms.delete(room) // Spacewalk keeps a clock of its own
    spacewalk.calls.length = 0

    await callTool('open_geenee', { room })
    const result = await callTool('spacewalk_reset_camera', { room })

    expect(names(spacewalk.calls)).toEqual(['read_viewer_count', 'open_viewer', 'reset_camera'])
    expect(result).toEqual({ content: [{ type: 'text', text: 'Done.' }] })
  })

  it('still opens geenee when the Spacewalk Upstream cannot be reached', async () => {
    const { callTool, spacewalk } = withSpacewalkRooms(geenee())
    const room = (await callTool('open_geenee')).structuredContent!.room as string
    spacewalk.unreachable = true

    const result = await callTool('open_geenee', { room })

    expect(result.isError).toBeFalsy()
    expect(result.structuredContent!.room).toBe(room)
  })
})

describe('open_geenee given a Room that has expired', () => {
  it('never reaches Spacewalk', async () => {
    const { callTool, clock, spacewalk } = withSpacewalkRooms(geenee())
    const room = (await callTool('open_geenee')).structuredContent!.room as string
    spacewalk.calls.length = 0
    clock.advance(DAY_MS)

    const result = await callTool('open_geenee', { room })

    expect(result.isError).toBe(true)
    expect(spacewalk.calls).toEqual([])
  })
})
