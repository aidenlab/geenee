/**
 * Where the Connector sends a tool call, and what it passes back.
 */
import { describe, expect, it } from 'vitest'
import { geenee } from './connector.ts'

const ROOM = '7ZQH4M2K9X'

describe('a call to an igv tool', () => {
  it('reaches the igv Upstream under its own name, with the Room id as its room argument', async () => {
    const { callTool, igv, juicebox } = geenee()

    const result = await callTool('igv_go_to_locus', { locus: 'chr8:127,000,000-128,000,000', room: ROOM })

    expect(igv.calls).toEqual([
      { name: 'go_to_locus', arguments: { locus: 'chr8:127,000,000-128,000,000', room: ROOM }, session: null },
    ])
    expect(juicebox.calls).toEqual([])
    expect(result).toEqual({ content: [{ type: 'text', text: 'Done.' }] })
  })
})

describe('a call to a Juicebox tool', () => {
  it('reaches the Juicebox Upstream under its own name, with the Room id as its MCP session and not as an argument', async () => {
    const { callTool, igv, juicebox } = geenee()

    await callTool('juicebox_zoom_in', { panel: 1, room: ROOM })

    expect(juicebox.calls).toEqual([{ name: 'zoom_in', arguments: { panel: 1 }, session: ROOM }])
    expect(igv.calls).toEqual([])
  })

  it('reaches the Upstream under the same name when geenee serves that name unchanged', async () => {
    const { callTool, juicebox } = geenee()

    await callTool('juicebox_help', { room: ROOM })

    expect(juicebox.calls.map((call) => call.name)).toEqual(['juicebox_help'])
  })
})

describe('a reply from an Upstream', () => {
  it('names tools by the names geenee serves', async () => {
    const { callTool, igv, juicebox } = geenee()
    igv.reply = () => ({
      content: [{ type: 'text', text: 'Error: no track is named "CTCF". Call read_session_summary, or load it with load_tracks.' }],
      isError: true,
    })
    juicebox.reply = () => ({
      content: [{ type: 'text', text: 'Error: No page is connected to this room. Use get_juicebox_url to get the join link and open it in a browser.' }],
      isError: true,
    })

    const fromIgv = await callTool('igv_remove_track', { name: 'CTCF', room: ROOM })
    const fromJuicebox = await callTool('juicebox_zoom_in', { room: ROOM })

    expect(fromIgv).toEqual({
      content: [{ type: 'text', text: 'Error: no track is named "CTCF". Call igv_read_session_summary, or load it with igv_load_tracks.' }],
      isError: true,
    })
    expect(fromJuicebox.content[0].text).toBe(
      'Error: No page is connected to this room. Use open_geenee to get the join link and open it in a browser.',
    )
  })

  it("passes on an Upstream's refusal of a call in the Upstream's words, naming tools as geenee serves them", async () => {
    const { callTool, igv } = geenee()
    igv.refusal = 'Invalid arguments for tool load_tracks: tracks is required'

    const result = await callTool('igv_load_tracks', { room: ROOM })

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Error: Invalid arguments for tool igv_load_tracks: tracks is required' }],
      isError: true,
    })
  })

  it('keeps a link whose address happens to hold a tool name', async () => {
    const { callTool, igv } = geenee()
    const text = 'Shareable URL:\nhttps://igv.org/app/?file=https://example.org/zoom_in/load_tracks.bw'
    igv.reply = () => ({ content: [{ type: 'text', text }] })

    const result = await callTool('igv_get_shareable_url', { room: ROOM })

    expect(result.content[0].text).toBe(text)
  })
})

describe('a call the Connector does not forward', () => {
  it('refuses a tool it does not serve, hidden ones included', async () => {
    const { rpc, igv, juicebox } = geenee()

    for (const name of ['igv_open_viewer', 'juicebox_get_juicebox_url', 'juicebox_join_room', 'zoom_in', 'igv_no_such_tool']) {
      const { result, error } = await rpc('tools/call', { name, arguments: { room: ROOM } })
      expect(result, name).toBeUndefined()
      expect(error?.message, name).toContain(`Unknown tool: ${name}`)
    }
    expect(igv.calls).toEqual([])
    expect(juicebox.calls).toEqual([])
  })

  it('refuses a call that names no Room, for either Viewer, and says how to get one', async () => {
    const { callTool, igv, juicebox } = geenee()

    for (const [name, args] of [['igv_zoom_in', {}], ['juicebox_zoom_in', { room: '' }]] as const) {
      const result = await callTool(name, args)
      expect(result.isError, name).toBe(true)
      expect(result.content[0].text, name).toBe(
        `Error: ${name} was called without room. Call open_geenee first if geenee is not open yet, then pass the Room id from its reply as room.`,
      )
    }
    expect(igv.calls).toEqual([])
    expect(juicebox.calls).toEqual([])
  })

  it('refuses a room that is not a Room id, for either Viewer', async () => {
    const { callTool, igv, juicebox } = geenee()

    for (const name of ['igv_zoom_in', 'juicebox_zoom_in']) {
      const result = await callTool(name, { room: 'my-room' })
      expect(result.isError, name).toBe(true)
      expect(result.content[0].text, name).toBe('Error: "my-room" is not a Room id. Pass the Room id from the reply of open_geenee.')
    }
    expect(igv.calls).toEqual([])
    expect(juicebox.calls).toEqual([])
  })

  it('takes a Room id in lower case or with spaces around it', async () => {
    const { callTool, igv, juicebox } = geenee()

    await callTool('igv_zoom_in', { room: ' 7zqh4m2k9x ' })
    await callTool('juicebox_zoom_in', { room: ' 7zqh4m2k9x ' })

    expect(igv.calls[0].arguments).toEqual({ room: ROOM })
    expect(juicebox.calls[0].session).toBe(ROOM)
  })
})
