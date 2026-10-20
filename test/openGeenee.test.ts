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

  it('says in its description that opening the link is the only thing the model does in the Pane', async () => {
    const [openGeenee] = await geenee().listTools()

    expect(openGeenee.description).toContain('open the geenee link there: that is the only thing you do in that page')
    expect(openGeenee.description).toContain('Never click, type, scroll, take screenshots, read the page or pick a tab in it')
    expect(openGeenee.description).toContain("everything else goes through geenee's tools")
    expect(openGeenee.description).not.toMatch(/if you have a browser|in-app browser/i)
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

  it('states the Pane rule in its result, rather than a sequence of browser steps', async () => {
    const [text] = (await geenee().callTool('open_geenee')).content

    expect(text.text).toContain('open the geenee link there: that is the only thing you do in that page')
    expect(text.text).toContain('Never click, type, scroll, take screenshots, read the page or pick a tab in it')
    expect(text.text).toContain("everything else goes through geenee's tools")
    expect(text.text).not.toContain('Next step')
    expect(text.text).not.toMatch(/if you have a browser|in-app browser/i)
  })

  it('says to go straight on with geenee tools when the user already asked for something, and only otherwise to ask what to look at', async () => {
    const [text] = (await geenee().callTool('open_geenee')).content

    expect(text.text).toContain('If the user already asked for something, go straight on to it with geenee tools')
    expect(text.text).toContain('Otherwise reply in one short sentence')
    expect(text.text).toContain('and ask what to look at')
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
