/**
 * open_geenee: geenee's own tool, which opens the Workspace.
 */
import { describe, expect, it } from 'vitest'
import { qrPng } from '../src/qrPng.ts'
import { GEENEE, geenee, type Tool } from './connector.ts'

const ROOM_ID = /^[0-9A-HJKMNP-TV-Z]{10}$/ // Crockford base32: no I, L, O, U

describe('open_geenee', () => {
  it('is listed first, making 57 tools with share_geenee and those of the three Upstreams', async () => {
    const tools = await geenee().listTools()

    expect(tools[0].name).toBe('open_geenee')
    expect(tools).toHaveLength(57)
  })

  it('takes room only to get the Workspace back beside the conversation, not to share the Room again', async () => {
    const { description } = (await geenee().listTools())[0].inputSchema.properties.room

    expect(description).toMatch(/^Only to get geenee back beside the conversation/)
    expect(description).not.toMatch(/share|Guest|QR|Card/i)
  })

  it('says it opens all three Viewers, and is called for Spacewalk and 3D chromatin too', async () => {
    const tool = (await geenee().listTools())[0]

    expect(tool.description).toContain('the Spacewalk 3D chromatin viewer')
    expect(tool.description).toContain('One call opens all three viewers')
    expect(tool.description).toContain('Spacewalk or 3D chromatin')
    expect(tool.description).toContain('"hello spacewalk"')
    expect(JSON.stringify(tool)).not.toMatch(/\bboth\b/)
  })

  it('says to call it first in a conversation, before any other geenee tool, greetings included, and first again once a Room has expired', async () => {
    const { description } = (await geenee().listTools())[0]

    expect(description).toMatch(/^Call this first in a conversation, before any other geenee tool/)
    for (const greeting of ['"hello geenee"', '"launch geenee"', '"hi igv"']) expect(description).toContain(greeting)
    expect(description).toContain('even when the user only greets')
    expect(description).toContain('has expired')
  })

  it('fits what Hosts read: the rule to call it first in the first 512 characters, and all of it in 2,048', async () => {
    const { description } = (await geenee().listTools())[0]

    expect(description.slice(0, 512)).toContain('before any other geenee tool')
    expect(description.slice(0, 512)).toContain('"hi igv"')
    expect(description.length).toBeLessThanOrEqual(2048)
  })

  it('tells the model to pass the Room id to every Viewer\'s tools', async () => {
    const result = await geenee().callTool('open_geenee')

    expect(result.content[0].text).toContain('for igv, Juicebox and Spacewalk tools alike')
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

  it('serves the Card, with Open Geenee as its button', async () => {
    const { rpc } = geenee()

    const listed = await rpc<{ resources: Array<{ uri: string; mimeType: string }> }>('resources/list')
    const read = await rpc<{ contents: Array<{ uri: string; mimeType: string; text: string }> }>('resources/read', { uri: 'ui://geenee/open' })

    expect(listed.result!.resources).toEqual([expect.objectContaining({ uri: 'ui://geenee/open', mimeType: 'text/html;profile=mcp-app' })])
    const [card] = read.result!.contents
    expect(card.mimeType).toBe('text/html;profile=mcp-app')
    expect(card.text).toMatch(/<button id="open" hidden><img src="data:image\/png;base64,[^"]+" alt="">Open Geenee<\/button>/)
    expect(card.text).toContain('geenee should open in the panel on the right; if it does not, press Open Geenee.')
    expect(card.text).not.toContain('<details') // the link and QR code are always shown, not tucked away
    expect(card.text).not.toContain('geenee room') // a Room id means nothing to a person
    expect(card.text).toContain('$("link").onclick = (e) => open(e, roomLink)') // a plain link does nothing in the Card's sandbox
  })

  it('has the Card speak to Guests under the QR code', async () => {
    const read = await geenee().rpc<{ contents: Array<{ text: string }> }>('resources/read', { uri: 'ui://geenee/open' })

    const card = read.result!.contents[0].text
    expect(card).toContain('Guests: scan to join this Room on your laptop. Expires after a day without use.')
    expect(card).not.toContain('Scan the QR code to open the same room')
  })

  it('has the Card show its QR code large, for projecting or screen-sharing, and back', async () => {
    const read = await geenee().rpc<{ contents: Array<{ text: string }> }>('resources/read', { uri: 'ui://geenee/open' })

    const card = read.result!.contents[0].text
    expect(card).toContain('<button id="large" class="quiet" aria-pressed="false" hidden>Show large</button>')
    expect(card).toContain('"Show small" : "Show large"')
    expect(card).toContain('new App({ name: "geenee", version: "1.0.0" }, { availableDisplayModes: ["inline", "fullscreen"] })')
    expect(card).toContain('app.requestDisplayMode({ mode: large ? "fullscreen" : "inline" })') // the whole Card, where the Host offers it
  })

  it('refuses a resource other than the Card', async () => {
    const { error } = await geenee().rpc('resources/read', { uri: 'ui://geenee/other' })

    expect(error?.message).toContain('Unknown resource')
  })

  it('gives the Card the Room link, the short link that brings anyone into the Room', async () => {
    const result = await geenee({ opened: ['7ZQH4M2K9X'] }).callTool('open_geenee', { room: '7ZQH4M2K9X' })

    expect(result.structuredContent!.roomUrl).toBe(`${GEENEE}/r/7ZQH4M2K9X`)
  })

  it('gives the Card a QR code of the Room link, as a PNG', async () => {
    const result = await geenee({ opened: ['7ZQH4M2K9X'] }).callTool('open_geenee', { room: '7ZQH4M2K9X' })

    const png = Uint8Array.from(atob(result.structuredContent!.qrPng as string), (c) => c.charCodeAt(0))
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(result.structuredContent!.qrPng).toBe(qrPng(`${GEENEE}/r/7ZQH4M2K9X`))
  })

  it('has the Card show the Room link as its text link, with the button opening geenee as before', async () => {
    const read = await geenee().rpc<{ contents: Array<{ text: string }> }>('resources/read', { uri: 'ui://geenee/open' })

    const card = read.result!.contents[0].text
    expect(card).toContain('roomLink = sc?.roomUrl ?? workspaceLink')
    expect(card).toContain('$("link").textContent = roomLink')
    expect(card).toContain('$("open").onclick = (e) => open(e, workspaceLink)')
  })

  it('gives, for Hosts that draw no Card, the Room link, the Room id and the QR address in its text, and the QR code as an image', async () => {
    const result = await geenee({ opened: ['7ZQH4M2K9X'] }).callTool('open_geenee', { room: '7ZQH4M2K9X' })

    const text = result.content[0].text!
    expect(text).toContain(`Room link: ${GEENEE}/r/7ZQH4M2K9X\n`)
    expect(text).toContain('Room id: 7ZQH4M2K9X.')
    expect(text).toContain(`QR code: ${GEENEE}/r/7ZQH4M2K9X/qr.png\n`)
    expect(result.content).toContainEqual({ type: 'image', mimeType: 'image/png', data: qrPng(`${GEENEE}/r/7ZQH4M2K9X`) })
  })

  it('gives the same four for a new Room as for one it opens again', async () => {
    const result = await geenee().callTool('open_geenee')

    const room = result.structuredContent!.room as string
    const text = result.content[0].text!
    expect(text).toContain(`Room link: ${GEENEE}/r/${room}\n`)
    expect(text).toContain(`Room id: ${room}.`)
    expect(text).toContain(`QR code: ${GEENEE}/r/${room}/qr.png\n`)
    expect(result.content).toContainEqual({ type: 'image', mimeType: 'image/png', data: qrPng(`${GEENEE}/r/${room}`) })
  })

  it('has the model repeat none of them where the Host draws the Card, and show them all everywhere else, the QR code as a Markdown image', async () => {
    const result = await geenee({ opened: ['7ZQH4M2K9X'] }).callTool('open_geenee', { room: '7ZQH4M2K9X' })

    const text = result.content[0].text!
    expect(text).toContain("Where this app draws geenee's Card (Claude desktop, claude.ai), do not repeat the Room link, the Room id or the QR code in your reply")
    expect(text).toContain('Everywhere else, show the user the Room link, the Room id and the QR code in your reply')
    expect(text).toContain(`![QR code of the Room link](${GEENEE}/r/7ZQH4M2K9X/qr.png)`)
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
    const { callTool } = geenee({ opened: ['7ZQH4M2K9X'] })

    const result = await callTool('open_geenee', { room: ' 7zqh4m2k9x ' })

    expect(result.structuredContent).toMatchObject({ room: '7ZQH4M2K9X', workspaceUrl: `${GEENEE}/?room=7ZQH4M2K9X` })
  })

  it('refuses a room that is not a Room id', async () => {
    const result = await geenee().callTool('open_geenee', { room: 'my-room' })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('"my-room" is not a Room id')
  })

  it('says so, and gives no link, when it cannot start a new Room', async () => {
    const { callTool, rooms } = geenee()
    rooms.unreachable = true

    const result = await callTool('open_geenee')

    expect(result).toEqual({ content: [{ type: 'text', text: 'Error: geenee could not open a Room. Try again in a moment.' }], isError: true })
  })

  it('needs nothing of the igv and Juicebox Upstreams', async () => {
    const { callTool, igv, juicebox } = geenee()
    igv.unreachable = true
    juicebox.unreachable = true

    const result = await callTool('open_geenee')

    expect(result.isError).toBeFalsy()
  })
})
