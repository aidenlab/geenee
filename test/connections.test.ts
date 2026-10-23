/**
 * GET /connections: what the Workspace asks geenee for the mark on each tab,
 * whether each Viewer is connected in its Room. Each Upstream says so in its
 * own way, and the replies here are copied from the dev Upstreams.
 */
import { describe, expect, it } from 'vitest'
import { GEENEE, geenee } from './connector.ts'

const ROOM = '7ZQH4M2K9X'

const IGV_CONNECTED = { content: [{ type: 'text', text: 'Done.\n\nSession summary:\n{\n  "genome": "hg38"\n}' }] }
const IGV_NOT_CONNECTED = {
  content: [{ type: 'text', text: `Error: no Viewer is in Room ${ROOM}. Call open_viewer with this room and open its Join link, then try again.` }],
  isError: true,
}

function juiceboxStatus(connected: 'Yes' | 'No') {
  return {
    content: [
      {
        type: 'text',
        text: `Server Status:\n\nMode: Cloudflare Workers\nCurrent Session ID: ${ROOM}\nRoom: ${ROOM}\nBrowser Connected: ${connected}\nBrowser URL: https://juicebot-dev.3dg.io/`,
      },
    ],
  }
}

/** A geenee whose Upstreams answer for a Room with each Viewer connected or not. */
function viewers(connected: { igv: boolean; juicebox: boolean }) {
  const connector = geenee({ opened: [ROOM] })
  connector.igv.reply = () => (connected.igv ? IGV_CONNECTED : IGV_NOT_CONNECTED)
  connector.juicebox.reply = () => juiceboxStatus(connected.juicebox ? 'Yes' : 'No')
  return connector
}

function connections(handle: (request: Request) => Promise<Response>, room = ROOM) {
  return handle(new Request(`${GEENEE}/connections?room=${room}`))
}

describe('GET /connections', () => {
  it('says each Viewer is connected when its Upstream says so, asking each with a tool that changes nothing', async () => {
    const { handle, igv, juicebox } = viewers({ igv: true, juicebox: true })

    const response = await connections(handle)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ igv: true, juicebox: true })
    expect(igv.calls).toEqual([{ name: 'read_session_summary', arguments: { room: ROOM }, session: null }])
    expect(juicebox.calls).toEqual([{ name: 'get_server_status', arguments: {}, session: ROOM }])
  })

  it('says a Viewer is not connected when its Upstream has none in the Room, each apart from the other', async () => {
    const onlyIgv = await connections(viewers({ igv: true, juicebox: false }).handle)
    const onlyJuicebox = await connections(viewers({ igv: false, juicebox: true }).handle)

    expect(await onlyIgv.json()).toEqual({ igv: true, juicebox: false })
    expect(await onlyJuicebox.json()).toEqual({ igv: false, juicebox: true })
  })

  it('says a Viewer whose Upstream cannot be reached is not connected, and still answers for the other', async () => {
    const { handle, igv } = viewers({ igv: true, juicebox: true })
    igv.unreachable = true

    const response = await connections(handle)

    expect(await response.json()).toEqual({ igv: false, juicebox: true })
  })

  it('tells no Workspace that a Viewer was used', async () => {
    const { handle, openWorkspace } = viewers({ igv: true, juicebox: true })
    const workspace = await openWorkspace(ROOM)

    await connections(handle)

    expect(workspace.told).toEqual([])
  })

  it('refuses a room that is not a Room id', async () => {
    const { handle, igv, juicebox } = viewers({ igv: true, juicebox: true })

    const response = await connections(handle, 'my-room')

    expect(response.status).toBe(400)
    expect(igv.calls).toEqual([])
    expect(juicebox.calls).toEqual([])
  })
})

describe('GET /ws', () => {
  it('refuses a room that is not a Room id', async () => {
    const { handle } = geenee({ opened: [ROOM] })

    const response = await handle(new Request(`${GEENEE}/ws?room=my-room`, { headers: { Upgrade: 'websocket' } }))

    expect(response.status).toBe(400)
  })
})
