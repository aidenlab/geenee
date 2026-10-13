/**
 * GET /viewers: what the Workspace asks geenee when it opens, to learn the
 * address of each Viewer in its Room.
 */
import { describe, expect, it } from 'vitest'
import { GEENEE, geenee } from './connector.ts'
import type { UpstreamCall } from './upstreams.ts'

const ROOM = '7ZQH4M2K9X'

/** Each Upstream's own open tool, as it answers: a Join link for the Room it was asked for. */
function joinLinks() {
  const connector = geenee()
  connector.igv.reply = (call: UpstreamCall) => ({
    content: [{ type: 'text', text: 'igv-bot Join link' }],
    structuredContent: { room: call.arguments.room, joinUrl: `https://igv-viewer.test/?room=${call.arguments.room}` },
  })
  connector.juicebox.reply = (call: UpstreamCall) => ({
    content: [{ type: 'text', text: 'Juicebox join link' }],
    structuredContent: { room: call.session, joinUrl: `https://juicebox-viewer.test/?room=${call.session}` },
  })
  return connector
}

describe('GET /viewers', () => {
  it("gives each Viewer's Join link for the Room, as its Upstream's own open tool gives it", async () => {
    const { handle, igv, juicebox } = joinLinks()

    const response = await handle(new Request(`${GEENEE}/viewers?room=${ROOM}`))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      igv: `https://igv-viewer.test/?room=${ROOM}`,
      juicebox: `https://juicebox-viewer.test/?room=${ROOM}`,
    })
    expect(igv.calls).toEqual([{ name: 'open_viewer', arguments: { room: ROOM }, session: null }])
    expect(juicebox.calls).toEqual([{ name: 'get_juicebox_url', arguments: {}, session: ROOM }])
  })

  it('gives null for a Viewer whose Upstream cannot be reached, and still the other', async () => {
    const { handle, juicebox } = joinLinks()
    juicebox.unreachable = true

    const response = await handle(new Request(`${GEENEE}/viewers?room=${ROOM}`))

    expect(await response.json()).toEqual({ igv: `https://igv-viewer.test/?room=${ROOM}`, juicebox: null })
  })

  it('gives null for a Viewer whose Upstream answers with an error', async () => {
    const { handle, igv } = joinLinks()
    igv.reply = () => ({ content: [{ type: 'text', text: 'Error: nope' }], isError: true })

    const response = await handle(new Request(`${GEENEE}/viewers?room=${ROOM}`))

    expect(await response.json()).toEqual({ igv: null, juicebox: `https://juicebox-viewer.test/?room=${ROOM}` })
  })

  it('refuses a room that is not a Room id', async () => {
    const { handle, igv, juicebox } = joinLinks()

    const response = await handle(new Request(`${GEENEE}/viewers?room=my-room`))

    expect(response.status).toBe(400)
    expect(igv.calls).toEqual([])
    expect(juicebox.calls).toEqual([])
  })
})
