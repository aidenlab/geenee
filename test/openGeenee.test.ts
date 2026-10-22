/**
 * open_geenee: geenee's own tool, which opens the Workspace.
 */
import { describe, expect, it } from 'vitest'
import { GEENEE, geenee, type Tool } from './connector.ts'

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
    expect(result.structuredContent).toMatchObject({ room, workspaceUrl: link })
    expect(result.content[0].type).toBe('text')
    expect(result.content[0].text).toContain(`\n${link}\n`) // on a line of its own, so Hosts render it clickable
    expect(result.content[0].text).toContain(`Room id: ${room}. Pass it as room on every later geenee tool call`)
    expect(result.content[1]).toMatchObject({ type: 'resource_link', uri: link, name: 'Open geenee', mimeType: 'text/html' })
  })

  it('shows the Card, which Hosts head as "Opened Get geenee link"', async () => {
    const tool = (await geenee().listTools())[0] as Tool & { title?: string }

    expect(tool.title).toBe('Get geenee link')
    expect(tool._meta).toEqual({ ui: { resourceUri: 'ui://geenee/open' }, 'ui/resourceUri': 'ui://geenee/open' })
  })

  it('serves the Card, with Open geenee as its button', async () => {
    const { rpc } = geenee()

    const listed = await rpc<{ resources: Array<{ uri: string; mimeType: string }> }>('resources/list')
    const read = await rpc<{ contents: Array<{ uri: string; mimeType: string; text: string }> }>('resources/read', { uri: 'ui://geenee/open' })

    expect(listed.result!.resources).toEqual([expect.objectContaining({ uri: 'ui://geenee/open', mimeType: 'text/html;profile=mcp-app' })])
    const [card] = read.result!.contents
    expect(card.mimeType).toBe('text/html;profile=mcp-app')
    expect(card.text).toContain('<button id="open" hidden>Open geenee</button>')
    expect(card.text).toContain('geenee should open in the panel on the right; if it does not, press Open geenee.')
    expect(card.text).not.toContain('<details') // the link and QR code are always shown, not tucked away
    expect(card.text).not.toContain('geenee room') // a Room id means nothing to a person
    expect(card.text).toContain('$("link").onclick = open') // a plain link does nothing in the Card's sandbox
  })

  it('refuses a resource other than the Card', async () => {
    const { error } = await geenee().rpc('resources/read', { uri: 'ui://geenee/other' })

    expect(error?.message).toContain('Unknown resource')
  })

  it('gives the Card a QR code of the link, as a PNG', async () => {
    const result = await geenee().callTool('open_geenee')

    const png = Uint8Array.from(atob(result.structuredContent!.qrPng as string), (c) => c.charCodeAt(0))
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  })

  it('has the model say only that geenee is opening', async () => {
    const result = await geenee().callTool('open_geenee')

    expect(result.content[0].text).toContain('"geenee is opening beside the conversation"')
    expect(result.content[0].text).not.toContain('ask what to look at')
    expect(result.content[0].text).not.toContain('use this link') // the Card shows the way in when the model cannot open geenee
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

    expect(result.structuredContent).toMatchObject({ room: '7ZQH4M2K9X', workspaceUrl: `${GEENEE}/?room=7ZQH4M2K9X` })
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
