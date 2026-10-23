/**
 * What geenee tells a Room's Workspace: which Viewer a tool call was for, so
 * that the Workspace can bring it forward (ADR 0002).
 */
import { describe, expect, it } from 'vitest'
import { geenee } from './connector.ts'

const ROOM = '7ZQH4M2K9X'
const OTHER_ROOM = '3K9XQ7ZH4M'

describe('a tool call that is forwarded', () => {
  it('is reported to the Workspace of its Room, for the Viewer whose tool it is', async () => {
    const { callTool, openWorkspace } = geenee({ opened: [ROOM, OTHER_ROOM] })
    const workspace = await openWorkspace(ROOM)

    await callTool('juicebox_zoom_in', { room: ROOM })
    await callTool('igv_go_to_gene', { gene: 'MYC', room: ROOM })

    expect(workspace.told).toEqual([
      { type: 'viewerUsed', viewer: 'juicebox', count: 1 },
      { type: 'viewerUsed', viewer: 'igv', count: 2 },
    ])
  })

  it('is reported for a tool that geenee serves under its own name', async () => {
    const { callTool, openWorkspace } = geenee({ opened: [ROOM, OTHER_ROOM] })
    const workspace = await openWorkspace(ROOM)

    await callTool('juicebox_help', { room: ROOM })

    expect(workspace.told).toEqual([{ type: 'viewerUsed', viewer: 'juicebox', count: 1 }])
  })

  it('reaches every Workspace of its Room, and none of another Room', async () => {
    const { callTool, openWorkspace } = geenee({ opened: [ROOM, OTHER_ROOM] })
    const first = await openWorkspace(ROOM)
    const second = await openWorkspace(ROOM)
    const elsewhere = await openWorkspace(OTHER_ROOM)

    await callTool('juicebox_zoom_in', { room: ' 7zqh4m2k9x ' })

    expect(first.told).toEqual([{ type: 'viewerUsed', viewer: 'juicebox', count: 1 }])
    expect(second.told).toEqual(first.told)
    expect(elsewhere.told).toEqual([])
  })

  it('is reported whatever the Upstream answers, an error included', async () => {
    const { callTool, openWorkspace, igv } = geenee({ opened: [ROOM, OTHER_ROOM] })
    igv.reply = () => ({ content: [{ type: 'text', text: `Error: no Viewer is in Room ${ROOM}.` }], isError: true })
    const workspace = await openWorkspace(ROOM)

    await callTool('igv_zoom_in', { room: ROOM })

    expect(workspace.told).toEqual([{ type: 'viewerUsed', viewer: 'igv', count: 1 }])
  })

  it('is still forwarded, and answered, when its Room cannot be told', async () => {
    const { callTool, rooms, igv } = geenee({ opened: [ROOM, OTHER_ROOM] })
    rooms.unreachable = true

    const result = await callTool('igv_zoom_in', { room: ROOM })

    expect(result).toEqual({ content: [{ type: 'text', text: 'Done.' }] })
    expect(igv.calls).toHaveLength(1)
  })
})

describe('a Workspace that joins its Room after a tool call', () => {
  it('is told the Viewer last used, and nothing in a Room where none was', async () => {
    const { callTool, openWorkspace } = geenee({ opened: [ROOM, OTHER_ROOM] })
    await callTool('igv_zoom_in', { room: ROOM })
    await callTool('juicebox_zoom_in', { room: ROOM })

    const late = await openWorkspace(ROOM)
    const unused = await openWorkspace(OTHER_ROOM)

    expect(late.told).toEqual([{ type: 'viewerUsed', viewer: 'juicebox', count: 2 }])
    expect(unused.told).toEqual([])
  })
})

describe('a call that is not forwarded', () => {
  it('is reported to no Workspace', async () => {
    const { callTool, rpc, openWorkspace, igv } = geenee({ opened: [ROOM, OTHER_ROOM] })
    const workspace = await openWorkspace(ROOM)

    await callTool('open_geenee', { room: ROOM })
    await callTool('igv_zoom_in', {})
    await rpc('tools/call', { name: 'igv_open_viewer', arguments: { room: ROOM } })
    await rpc('tools/call', { name: 'juicebox_no_such_tool', arguments: { room: ROOM } })
    igv.unreachable = true
    await callTool('igv_zoom_in', { room: ROOM })

    expect(workspace.told).toEqual([])
  })
})
