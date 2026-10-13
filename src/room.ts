import { DurableObject } from 'cloudflare:workers'
import { reportUse, welcome, type RoomHold, type ViewerKey, type ViewerUsed } from './workspaceChannel.ts'

const LAST_USE_KEY = 'lastUse'

/**
 * One instance per Room id, holding geenee's channel to the Workspaces of the
 * Room (ADR 0002). Workspaces arrive on `fetch` (the WebSocket upgrade from
 * /ws?room=) and are held with the Hibernation API, so an idle Room costs
 * nothing. The channel runs one way: a Workspace is told which Viewer a tool
 * call was for (workspaceChannel.ts), and what it sends is not read. The last
 * report is all a Room stores, and it is never deleted: its count must not
 * start again while a Workspace that acted on an earlier one may still be open.
 */
export class Room extends DurableObject<Env> {
  private hold: RoomHold = {
    workspaces: () => this.ctx.getWebSockets(),
    lastUse: () => this.ctx.storage.get<ViewerUsed>(LAST_USE_KEY),
    keep: (use) => this.ctx.storage.put(LAST_USE_KEY, use),
  }

  /** A tool call was for `viewer`. Called by the Connector over RPC. */
  async viewerUsed(viewer: ViewerKey): Promise<void> {
    await reportUse(this.hold, viewer)
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Not Found', { status: 404 })

    const { 0: client, 1: server } = new WebSocketPair()
    this.ctx.acceptWebSocket(server)
    // A Workspace that opens after a tool call, or joins again, still learns which Viewer was last used.
    await welcome(this.hold, server)
    return new Response(null, { status: 101, webSocket: client })
  }

  webSocketClose(ws: WebSocket): void {
    // Answer the close so the socket leaves the Room.
    try {
      ws.close()
    } catch {
      /* already closed */
    }
  }
}
