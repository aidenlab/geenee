/**
 * Spacewalk, the third Upstream: its tools as geenee serves them, where a call
 * goes, and how geenee learns its Join link and whether it is connected. The
 * replies here are copied from the dev Upstream.
 */
import { describe, expect, it } from 'vitest'
import { GEENEE, geenee } from './connector.ts'
import type { UpstreamCall } from './upstreams.ts'

const ROOM = '7ZQH4M2K9X'

describe('the Spacewalk tools', () => {
  it('are served under the spacewalk prefix, without its hidden open_viewer or its withheld tools', async () => {
    const names = (await geenee().listTools()).map((tool) => tool.name)

    expect(names.filter((name) => name.startsWith('spacewalk_')).sort()).toEqual([
      'spacewalk_adjust_background',
      'spacewalk_list_example_ensembles',
      'spacewalk_load_ensemble',
      'spacewalk_load_session',
      'spacewalk_read_viewer_state',
      'spacewalk_reset_camera',
      'spacewalk_select_ensemble_group',
      'spacewalk_set_background_color',
      'spacewalk_set_render_style',
      'spacewalk_step_ball_radius',
      'spacewalk_step_stick_radius',
    ])
    expect(names).not.toContain('spacewalk_open_viewer')
    expect(names).not.toContain('spacewalk_get_shareable_url')
    expect(names).not.toContain('spacewalk_read_viewer_count')
  })

  it('each take a required room argument', async () => {
    const tools = (await geenee().listTools()).filter((tool) => tool.name.startsWith('spacewalk_'))

    expect(tools.filter((tool) => !tool.inputSchema.required?.includes('room')).map((tool) => tool.name)).toEqual([])
  })
})

/** A geenee with a Room open_geenee has opened, Spacewalk's included, and that Room's id; the calls that opened it are forgotten. */
async function openedByOpenGeenee() {
  const connector = geenee()
  connector.spacewalk.reply = (call: UpstreamCall) => ({
    content: [{ type: 'text', text: call.name === 'open_viewer' ? 'Spacewalk Room link' : 'Done.' }],
    ...(call.name === 'open_viewer' ? { structuredContent: { roomLink: `https://spacewalk-viewer.test/?room=${call.arguments.room}` } } : {}),
  })
  const room = (await connector.callTool('open_geenee')).structuredContent!.room as string
  connector.spacewalk.calls.length = 0
  return { ...connector, room }
}

describe('a call to a Spacewalk tool', () => {
  it('reaches the Spacewalk Upstream under its own name, with the Room id as its room argument', async () => {
    const { callTool, igv, juicebox, spacewalk, room } = await openedByOpenGeenee()

    const result = await callTool('spacewalk_set_render_style', { style: 'tube', room })

    expect(spacewalk.calls).toEqual([{ name: 'set_render_style', arguments: { style: 'tube', room }, session: null }])
    expect(igv.calls).toEqual([])
    expect(juicebox.calls).toEqual([])
    expect(result).toEqual({ content: [{ type: 'text', text: 'Done.' }] })
  })

  // The dev Upstream was seen to accept list_example_ensembles with a room it does not declare.
  it('passes room even to list_example_ensembles, whose Upstream version takes none', async () => {
    const { callTool, spacewalk, room } = await openedByOpenGeenee()

    await callTool('spacewalk_list_example_ensembles', { room })

    expect(spacewalk.calls).toEqual([{ name: 'list_example_ensembles', arguments: { room }, session: null }])
  })

  it('tells the Workspaces of the Room that Spacewalk was used', async () => {
    const { callTool, openWorkspace } = geenee({ opened: [ROOM] })
    const workspace = await openWorkspace(ROOM)

    await callTool('spacewalk_reset_camera', { room: ROOM })

    expect(workspace.told).toEqual([{ type: 'viewerUsed', viewer: 'spacewalk', count: 1 }])
  })
})

describe('a reply from the Spacewalk Upstream', () => {
  it('names tools by the names geenee serves', async () => {
    const { callTool, spacewalk } = geenee({ opened: [ROOM] })
    spacewalk.reply = () => ({
      content: [{ type: 'text', text: 'The example ensembles, by group. Load one by passing its URL to load_ensemble. Call open_viewer first.' }],
    })

    const result = await callTool('spacewalk_list_example_ensembles', { room: ROOM })

    expect(result.content[0].text).toBe(
      'The example ensembles, by group. Load one by passing its URL to spacewalk_load_ensemble. Call open_geenee first.',
    )
  })
})

describe('GET /viewers', () => {
  it("gives Spacewalk's Join link from the roomLink of its open_viewer reply", async () => {
    const { handle, spacewalk } = geenee({ opened: [ROOM] })
    spacewalk.reply = (call: UpstreamCall) => ({
      content: [{ type: 'text', text: 'Spacewalk Room link' }],
      structuredContent: { room: call.arguments.room, roomLink: `https://spacewalk-viewer.test/viewer.html?room=${call.arguments.room}` },
    })

    const response = await handle(new Request(`${GEENEE}/viewers?room=${ROOM}`))

    expect(((await response.json()) as { spacewalk: unknown }).spacewalk).toBe(`https://spacewalk-viewer.test/viewer.html?room=${ROOM}`)
    expect(spacewalk.calls).toEqual([{ name: 'open_viewer', arguments: { room: ROOM }, session: null }])
  })
})

describe('GET /connections', () => {
  function connections(viewers: number) {
    const connector = geenee({ opened: [ROOM] })
    connector.spacewalk.reply = () => ({ content: [{ type: 'text', text: `Viewers connected: ${viewers}.` }], structuredContent: { viewers } })
    return connector
  }

  it('says Spacewalk is connected when its Upstream counts a Viewer in the Room', async () => {
    const { handle, spacewalk } = connections(1)

    const response = await handle(new Request(`${GEENEE}/connections?room=${ROOM}`))

    expect(((await response.json()) as { spacewalk: unknown }).spacewalk).toBe(true)
    expect(spacewalk.calls).toEqual([{ name: 'read_viewer_count', arguments: { room: ROOM }, session: null }])
  })

  it('says Spacewalk is not connected when its Upstream counts none', async () => {
    const { handle } = connections(0)

    const response = await handle(new Request(`${GEENEE}/connections?room=${ROOM}`))

    expect(((await response.json()) as { spacewalk: unknown }).spacewalk).toBe(false)
  })
})

describe('with the Spacewalk Upstream unreachable', () => {
  it('still lists open_geenee and the igv and Juicebox tools', async () => {
    const { listTools, spacewalk } = geenee({ opened: [ROOM] })
    spacewalk.unreachable = true

    const names = (await listTools()).map((tool) => tool.name)

    expect(names).toHaveLength(45)
    expect(names.filter((name) => name.startsWith('spacewalk_'))).toEqual([])
  })

  it('answers a call to a Spacewalk tool by saying the Spacewalk Viewer cannot be reached', async () => {
    const { callTool, spacewalk } = geenee({ opened: [ROOM] })
    spacewalk.unreachable = true

    const result = await callTool('spacewalk_reset_camera', { room: ROOM })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe(
      'Error: geenee could not reach the server of the Spacewalk viewer, so spacewalk_reset_camera was not sent. The igv and Juicebox tools are not affected. Try again in a moment.',
    )
  })
})
