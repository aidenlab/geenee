/**
 * open_geenee: geenee's own tool, which opens the Workspace.
 */
import { describe, expect, it } from 'vitest'
import { GEENEE, geenee } from './connector.ts'

const ROOM_ID = /^[0-9A-HJKMNP-TV-Z]{10}$/ // Crockford base32: no I, L, O, U

describe('open_geenee', () => {
  it('is listed first, making 44 tools with those of the two Upstreams', async () => {
    const tools = await geenee().listTools()

    expect(tools[0].name).toBe('open_geenee')
    expect(tools).toHaveLength(44)
  })

  it('gives the model one new Room id and the link that opens the Workspace in that Room', async () => {
    const { callTool } = geenee()

    const result = await callTool('open_geenee')

    const room = result.structuredContent!.room as string
    expect(room).toMatch(ROOM_ID)
    const link = `${GEENEE}/?room=${room}`
    expect(result.isError).toBeFalsy()
    expect(result.structuredContent).toEqual({ room, workspaceUrl: link })
    expect(result.content[0].type).toBe('text')
    expect(result.content[0].text).toContain(`\n${link}\n`) // on a line of its own, so Hosts render it clickable
    expect(result.content[0].text).toContain(`Room id: ${room}. Pass it as room on every later geenee tool call`)
    expect(result.content[1]).toMatchObject({ type: 'resource_link', uri: link, name: 'Open geenee', mimeType: 'text/html' })
  })

  it('opens a Room of its own each time it is called without a room', async () => {
    const { callTool } = geenee()

    const first = await callTool('open_geenee')
    const second = await callTool('open_geenee')

    expect(second.structuredContent!.room).not.toBe(first.structuredContent!.room)
  })

  it('given the Room id of an earlier reply, gives the link to that Room again', async () => {
    const { callTool } = geenee()

    const result = await callTool('open_geenee', { room: ' 7zqh4m2k9x ' })

    expect(result.structuredContent).toEqual({ room: '7ZQH4M2K9X', workspaceUrl: `${GEENEE}/?room=7ZQH4M2K9X` })
  })

  it('refuses a room that is not a Room id', async () => {
    const result = await geenee().callTool('open_geenee', { room: 'my-room' })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('"my-room" is not a Room id')
  })

  it('asks nothing of the Upstreams', async () => {
    const { callTool, igv, juicebox } = geenee()
    igv.unreachable = true
    juicebox.unreachable = true

    const result = await callTool('open_geenee')

    expect(result.isError).toBeFalsy()
  })
})
