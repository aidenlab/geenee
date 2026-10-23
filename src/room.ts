import { DurableObject } from 'cloudflare:workers'
import { hasExpired, start, use, type RoomClock } from './roomLife.ts'
import { reportUse, welcome, type RoomHold, type ViewerKey, type ViewerUsed } from './workspaceChannel.ts'

const LAST_USE_KEY = 'lastUse'
const USED_AT_KEY = 'usedAt'
const JOIN_LINKS_KEY = 'joinLinks'

/**
 * One instance per Room id: geenee's record of the Room, which never expires.
 * It keeps the time the Room was last used, by which geenee knows when the
 * Room has expired (roomLife.ts, ADR 0003), and each Viewer's Join link, asked
 * of its Upstream once. It holds geenee's channel to the Workspaces of the Room
 * (ADR 0002). Workspaces arrive on `fetch` (the WebSocket upgrade from
 * /ws?room=) and are held with the Hibernation API, so an idle Room costs
 * nothing. The channel runs one way: a Workspace is told which Viewer a tool
 * call was for (workspaceChannel.ts), and what it sends is not read. Nothing
 * a Room stores is ever deleted: the count of its last report must not start
 * again while a Workspace that acted on an earlier one may still be open.
 */
export class Room extends DurableObject<Env> {
  private hold: RoomHold = {
    workspaces: () => this.ctx.getWebSockets(),
    lastUse: () => this.ctx.storage.get<ViewerUsed>(LAST_USE_KEY),
    keep: (use) => this.ctx.storage.put(LAST_USE_KEY, use),
  }

  private clock: RoomClock = {
    usedAt: () => this.ctx.storage.get<number>(USED_AT_KEY),
    keepUsedAt: (at) => this.ctx.storage.put(USED_AT_KEY, at),
  }

  /** open_geenee opened this Room, new, at `now`. Called by the Connector over RPC. */
  async start(now: number): Promise<void> {
    await start(this.clock, now)
  }

  /** A use of this Room at `now`: false when it has expired. Called by the Connector over RPC. */
  async use(now: number): Promise<boolean> {
    return use(this.clock, now)
  }

  /** Whether this Room has expired at `now`; asking is not a use. Called by the Connector over RPC. */
  async expired(now: number): Promise<boolean> {
    return hasExpired(this.clock, now)
  }

  /** The Join link of each Viewer whose Upstream has given one for this Room. Called by the Connector over RPC. */
  async joinLinks(): Promise<Partial<Record<ViewerKey, string>>> {
    return (await this.ctx.storage.get<Partial<Record<ViewerKey, string>>>(JOIN_LINKS_KEY)) ?? {}
  }

  /** Keeps `viewer`'s Join link for this Room. Called by the Connector over RPC. */
  async keepJoinLink(viewer: ViewerKey, link: string): Promise<void> {
    await this.ctx.storage.put(JOIN_LINKS_KEY, { ...(await this.joinLinks()), [viewer]: link })
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
