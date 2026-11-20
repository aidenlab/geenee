/**
 * share_geenee: geenee's own tool, which shows the Card of a Room again, for
 * Guests who arrive after the first Card has scrolled out of sight.
 */
import { describe, expect, it } from 'vitest'
import { GEENEE, geenee, type Tool } from './connector.ts'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/** A geenee with a Room just opened by open_geenee, and that Room's id. */
async function withRoom() {
  const connector = geenee()
  const opened = await connector.callTool('open_geenee')
  return { ...connector, room: opened.structuredContent!.room as string }
}

describe('share_geenee', () => {
  it('is listed after open_geenee, with the Card, and needs room', async () => {
    const tools = await geenee().listTools()

    const tool = tools[1] as Tool & { title?: string }
    expect(tool.name).toBe('share_geenee')
    expect(tool._meta).toEqual({ ui: { resourceUri: 'ui://geenee/open' }, 'ui/resourceUri': 'ui://geenee/open' })
    expect(tool.inputSchema.required).toEqual(['room'])
    expect(tool.inputSchema.properties.room.description).toContain('open_geenee')
  })

  it('given a live Room, shows the same Card again: the same Room, Room link and QR code, opening nothing in the Upstreams', async () => {
    const { callTool, igv, juicebox, spacewalk } = geenee()
    const opened = await callTool('open_geenee')
    const room = opened.structuredContent!.room as string
    for (const upstream of [igv, juicebox, spacewalk]) upstream.calls.length = 0

    const shared = await callTool('share_geenee', { room })

    expect(shared.isError).toBeFalsy()
    expect(shared.structuredContent).toEqual(opened.structuredContent)
    expect(shared.structuredContent).toMatchObject({ room, roomUrl: `${GEENEE}/r/${room}`, workspaceUrl: `${GEENEE}/?room=${room}` })
    expect(igv.calls).toEqual([])
    expect(juicebox.calls).toEqual([])
    expect(spacewalk.calls).toEqual([])
  })

  it('given an expired Room, gives the expired-Room reply, and no Card', async () => {
    const { callTool, clock, room } = await withRoom()
    clock.advance(DAY)

    const result = await callTool('share_geenee', { room })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe(`Error: Room ${room} has expired. Call open_geenee without room to open geenee in a new Room.`)
    expect(result.structuredContent).toBeUndefined()
  })

  it('without room is refused, and points to open_geenee', async () => {
    const result = await geenee().callTool('share_geenee')

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('call open_geenee instead')
    expect(result.structuredContent).toBeUndefined()
  })

  it('counts as use of the Room, so its day without use starts again', async () => {
    const { callTool, clock, room } = await withRoom()
    clock.advance(DAY - HOUR)
    await callTool('share_geenee', { room })
    clock.advance(DAY - HOUR)

    const result = await callTool('igv_zoom_in', { room })

    expect(result.isError).toBeFalsy()
  })

  it('refuses a room that is not a Room id', async () => {
    const result = await geenee().callTool('share_geenee', { room: 'my-room' })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('"my-room" is not a Room id')
  })
})
