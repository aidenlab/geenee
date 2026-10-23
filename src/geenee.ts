/**
 * geenee: the Connector at /mcp, forwarding to the two Upstreams (ADR 0001).
 *
 * Routes:
 *   POST /mcp     - MCP protocol (stateless Streamable HTTP, JSON responses)
 *   GET  /mcp     - 405 (no SSE stream)
 *   OPTIONS /mcp  - CORS preflight
 *   GET  /viewers?room= - the address of each Viewer in a Room, for the Workspace; 410 when the Room has expired
 *   GET  /connections?room= - whether each Viewer is connected in a Room, for the marks on the Workspace's tabs; 410 likewise
 *   GET  /ws?room= - WebSocket upgrade → the Room's Durable Object (Workspaces)
 *   GET  /r/<Room id> - the Room link: the Workspace page, or a page saying the Room has expired or its id is malformed
 *   GET  /h/<Room id> - the Hand-off, where a phone sends the Room link on to a computer, or the same expired page
 *   GET  /get - Get geenee: what geenee is and how to add it to each Host
 *
 * The Workspace page itself is a static asset, served beside this at /.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { CARD_HTML, CARD_META, CARD_MIME_TYPE, CARD_URI } from './card.ts'
import { EXPIRED_ROOM_HTML } from './expiredRoom.ts'
import { getGeeneePage } from './getGeenee.ts'
import { handOffPage } from './handOff.ts'
import { INSTRUCTIONS } from './instructions.ts'
import { MALFORMED_ROOM_LINK_HTML } from './malformedRoomLink.ts'
import { OPEN_GEENEE_TOOL, openGeenee } from './openGeenee.ts'
import { pageResponse } from './page.ts'
import { inHandOffPath, inRoomLinkPath, mintRoomId, parseRoomId } from './roomId.ts'
import { IGV, JUICEBOX, OPEN_GEENEE, serveTools, type Viewer } from './servedTools.ts'
import { upstreamAt, type ToolResult, type Upstream } from './upstream.ts'
import type { ViewerKey } from './workspaceChannel.ts'

/**
 * geenee's record of one Room (room.ts), which never expires: when the Room was
 * last used (roomLife.ts), its Viewers' Join links, and the channel to its
 * Workspaces.
 */
export interface RoomRecord {
  /** A new Room, opened at `now`. */
  start(now: number): Promise<void>
  /** A use of the Room at `now`: false, and nothing kept, when it has expired. */
  use(now: number): Promise<boolean>
  /** Whether the Room has expired at `now`. Asking is not a use. */
  expired(now: number): Promise<boolean>
  /** The Join link of each Viewer whose Upstream has given one for the Room. */
  joinLinks(): Promise<Partial<Record<ViewerKey, string>>>
  keepJoinLink(viewer: ViewerKey, link: string): Promise<void>
  /** Tells the Room's Workspaces that a tool call was for `viewer`. */
  viewerUsed(viewer: ViewerKey): Promise<void>
  /** Takes the WebSocket upgrade of a Workspace joining the Room. */
  connect(request: Request): Promise<Response>
}

export interface GeeneeConfig {
  /** The igv Upstream's /mcp address. */
  igvUpstream: string
  /** The Juicebox Upstream's /mcp address. */
  juiceboxUpstream: string
  /** How the Upstreams are reached; the tests pass stand-ins. */
  fetch: typeof globalThis.fetch
  /** geenee's record of a Room, by Room id; the tests pass stand-ins. */
  roomRecord: (room: string) => RoomRecord
  /** The time, in milliseconds since the epoch; the tests pass a clock of their own. */
  now: () => number
  /** The Workspace page, the static asset served at / beside `request`; the tests pass a stand-in. */
  workspacePage: (request: Request) => Promise<Response>
}

/** What the Workspace is told of a Room that has expired, from which it goes to the Room link and so to the expired page. */
function roomExpired(): Response {
  return new Response('This Room has expired', { status: 410 })
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, mcp-session-id, mcp-protocol-version',
}

function withCors(response: Response): Response {
  const patched = new Response(response.body, response)
  for (const [key, value] of Object.entries(CORS_HEADERS)) patched.headers.set(key, value)
  return patched
}

function errorReply(text: string): ToolResult {
  return { content: [{ type: 'text', text: `Error: ${text}` }], isError: true }
}

/** The Room a call names, undefined when it names none. An empty string is an argument left out, not a malformed Room id. */
function roomNamed(room: unknown): { id: string } | { refusal: ToolResult } | undefined {
  if (room === undefined || room === null || (typeof room === 'string' && room.trim() === '')) return undefined
  const id = typeof room === 'string' ? parseRoomId(room) : null
  if (id) return { id }
  return { refusal: errorReply(`${JSON.stringify(room)} is not a Room id. Pass the Room id from the reply of ${OPEN_GEENEE}.`) }
}

interface Target {
  viewer: Viewer
  upstream: Upstream
}

/** Calls an Upstream's tool, by the Upstream's own name for it, for a Room. */
function callInRoom({ viewer, upstream }: Target, upstreamName: string, args: Record<string, unknown>, room: string): Promise<ToolResult> {
  return viewer.roomGoesIn === 'argument' ? upstream.callTool(upstreamName, { ...args, room }) : upstream.callTool(upstreamName, args, room)
}

/**
 * Passes a call of a tool geenee serves to its Upstream, and the reply back,
 * telling the Room's Workspaces meanwhile which Viewer the call is for.
 * Undefined when the Upstream has no such tool, or geenee hides it. An Upstream
 * that cannot be reached throws.
 */
async function forward(
  target: Target,
  name: string,
  args: Record<string, unknown>,
  room: string,
  workspaces: RoomRecord,
): Promise<ToolResult | undefined> {
  const served = serveTools(target.viewer, await target.upstream.listTools())
  const called = served.tools.find(({ tool }) => tool.name === name)
  if (!called) return undefined
  // Alongside the call, so that the Viewer is in front while it redraws. A Workspace that is not told still has its tabs.
  const told = workspaces.viewerUsed(target.viewer.prefix).catch((error) => {
    console.warn(`[mcp] ${name} | the Workspaces of Room ${room} could not be told:`, error)
  })
  const [result] = await Promise.all([callInRoom(target, called.upstreamName, args, room), told])
  // One log line per forwarded call, so a run can be read back from the Worker's log.
  console.log(`[mcp] ${name} | ${target.viewer.name} Upstream ${called.upstreamName} | Room ${room}${result.isError ? ' | error' : ''}`)
  return served.reply(result)
}

/** A Viewer's Join link for a Room, as its Upstream's own open tool gives it; null when the Upstream does not give one. */
async function joinLink(target: Target, room: string): Promise<string | null> {
  try {
    const { isError, structuredContent } = await callInRoom(target, target.viewer.openTool, {}, room)
    return !isError && typeof structuredContent?.joinUrl === 'string' ? structuredContent.joinUrl : null
  } catch (error) {
    console.warn(`[viewers] the ${target.viewer.name} Upstream could not be reached:`, error)
    return null
  }
}

/** Whether a Viewer is connected in a Room, as its Upstream says; a Viewer whose Upstream cannot be reached is not. */
async function isConnected(target: Target, room: string): Promise<boolean> {
  const { tool, connected } = target.viewer.connection
  try {
    return connected(await callInRoom(target, tool, {}, room))
  } catch (error) {
    console.warn(`[connections] the ${target.viewer.name} Upstream could not be reached:`, error)
    return false
  }
}

/** What the model is told of a Room that has expired: open geenee again, in a new Room. */
function expiredReply(room: string, unsent?: string): ToolResult {
  const notSent = unsent ? `, so ${unsent} was not sent` : ''
  const again = unsent ? ', then make this call again with the new Room id' : ''
  return errorReply(`Room ${room} has expired${notSent}. Call ${OPEN_GEENEE} without room to open geenee in a new Room${again}.`)
}

export function createGeenee({ igvUpstream, juiceboxUpstream, fetch, roomRecord, now, workspacePage }: GeeneeConfig): (request: Request) => Promise<Response> {
  const targets: Target[] = [
    { viewer: IGV, upstream: upstreamAt(igvUpstream, fetch) },
    { viewer: JUICEBOX, upstream: upstreamAt(juiceboxUpstream, fetch) },
  ]

  /** Whether a tool call for `room` finds it open, which is a use of it. A Room that cannot be asked is taken to be open: the Upstreams still have their say. */
  async function stillOpen(room: string, name: string): Promise<boolean> {
    try {
      return await roomRecord(room).use(now())
    } catch (error) {
      console.warn(`[mcp] ${name} | Room ${room} could not be asked whether it has expired:`, error)
      return true
    }
  }

  /** Workers are stateless, so every request gets a fresh server and transport, as in both Upstreams. */
  async function handleMcpRequest(request: Request): Promise<Response> {
    const server = new Server({ name: 'geenee', version: import.meta.env.VITE_BUILD ?? '0.0.0' }, { capabilities: { tools: {}, resources: {} }, instructions: INSTRUCTIONS })
    // The Card is geenee's one resource; open_geenee points Hosts that render MCP Apps to it.
    server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [{ uri: CARD_URI, name: 'geenee card', mimeType: CARD_MIME_TYPE, _meta: CARD_META }],
    }))
    server.setRequestHandler(ReadResourceRequestSchema, async ({ params: { uri } }) => {
      if (uri !== CARD_URI) throw new McpError(ErrorCode.InvalidParams, `Unknown resource: ${uri}`)
      return { contents: [{ uri, mimeType: CARD_MIME_TYPE, text: CARD_HTML, _meta: CARD_META }] }
    })
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      // An Upstream that cannot be reached leaves its tools out; the other's are still served.
      const lists = await Promise.all(
        targets.map(async ({ viewer, upstream }) => {
          try {
            return serveTools(viewer, await upstream.listTools()).tools.map(({ tool }) => tool)
          } catch (error) {
            console.warn(`[mcp] tools/list | the ${viewer.name} Upstream could not be reached:`, error)
            return []
          }
        }),
      )
      return { tools: [OPEN_GEENEE_TOOL, ...lists.flat()] }
    })
    server.setRequestHandler(CallToolRequestSchema, async ({ params: { name, arguments: { room: named, ...args } = {} } }) => {
      const room = roomNamed(named)
      if (room && 'refusal' in room) return room.refusal
      if (name === OPEN_GEENEE) {
        const origin = new URL(request.url).origin
        if (room) return (await stillOpen(room.id, name)) ? openGeenee(origin, room.id) : expiredReply(room.id)
        const minted = mintRoomId()
        try {
          await roomRecord(minted).start(now())
        } catch (error) {
          console.warn(`[mcp] ${name} | Room ${minted} could not be started:`, error)
          return errorReply('geenee could not open a Room. Try again in a moment.')
        }
        return openGeenee(origin, minted)
      }

      const target = targets.find(({ viewer }) => name.startsWith(`${viewer.prefix}_`))
      if (!target) throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${name}`)
      if (!room) {
        return errorReply(
          `${name} was called without room. Call ${OPEN_GEENEE} first if geenee is not open yet, then pass the Room id from its reply as room.`,
        )
      }
      if (!(await stillOpen(room.id, name))) return expiredReply(room.id, name)
      let result: ToolResult | undefined
      try {
        result = await forward(target, name, args, room.id, roomRecord(room.id))
      } catch (error) {
        const { viewer } = target
        console.warn(`[mcp] ${name} | the ${viewer.name} Upstream could not be reached:`, error)
        const others = targets.filter((other) => other !== target).map((other) => other.viewer.name)
        return errorReply(
          `geenee could not reach the server of the ${viewer.name} viewer, so ${name} was not sent. The ${others.join(' and ')} tools are not affected. Try again in a moment.`,
        )
      }
      if (!result) throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${name}`)
      return result
    })
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    await server.connect(transport)
    return transport.handleRequest(request)
  }

  return async (request) => {
    const url = new URL(request.url)
    if (url.pathname === '/mcp') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
      if (request.method !== 'POST') {
        return new Response('Method not allowed. Use Streamable HTTP (POST).', {
          status: 405,
          headers: { ...CORS_HEADERS, Allow: 'POST, OPTIONS' },
        })
      }
      return withCors(await handleMcpRequest(request))
    }
    if (url.pathname === '/viewers' && request.method === 'GET') {
      const room = parseRoomId(url.searchParams.get('room') ?? '')
      if (!room) return new Response('Missing or malformed room', { status: 400 })
      const record = roomRecord(room)
      if (!(await record.use(now()))) return roomExpired()
      // Each Upstream is asked once, while the Room is new: asked later, the igv one would revive a Room it has expired.
      const kept = await record.joinLinks()
      const links = await Promise.all(
        targets.map(async (target) => {
          const { prefix } = target.viewer
          let link = kept[prefix] ?? null
          if (!link) {
            link = await joinLink(target, room)
            if (link) await record.keepJoinLink(prefix, link)
          }
          return [prefix, link]
        }),
      )
      return Response.json(Object.fromEntries(links))
    }
    if (url.pathname === '/connections' && request.method === 'GET') {
      const room = parseRoomId(url.searchParams.get('room') ?? '')
      if (!room) return new Response('Missing or malformed room', { status: 400 })
      // A Workspace asks this every few seconds while it is looked at, so a Room someone is looking at stays in use.
      if (!(await roomRecord(room).use(now()))) return roomExpired()
      const connected = await Promise.all(targets.map(async (target) => [target.viewer.prefix, await isConnected(target, room)]))
      return Response.json(Object.fromEntries(connected))
    }
    const roomLink = inRoomLinkPath(url.pathname)
    if (roomLink !== null && request.method === 'GET') {
      const room = parseRoomId(roomLink)
      if (!room) return pageResponse(MALFORMED_ROOM_LINK_HTML, 404)
      if (await roomRecord(room).expired(now())) return pageResponse(EXPIRED_ROOM_HTML, 410)
      // The Workspace page itself, so that the address bar keeps the short link; the Workspace reads the Room id from it.
      return workspacePage(request)
    }
    const handOff = inHandOffPath(url.pathname)
    if (handOff !== null && request.method === 'GET') {
      const room = parseRoomId(handOff)
      if (!room) return pageResponse(MALFORMED_ROOM_LINK_HTML, 404)
      if (await roomRecord(room).expired(now())) return pageResponse(EXPIRED_ROOM_HTML, 410)
      return pageResponse(handOffPage(url.origin, room))
    }
    if (url.pathname === '/get' && request.method === 'GET') {
      return pageResponse(getGeeneePage(url.origin))
    }
    if (url.pathname === '/ws' && request.headers.get('Upgrade') === 'websocket') {
      const room = parseRoomId(url.searchParams.get('room') ?? '')
      if (!room) return new Response('Missing or malformed room', { status: 400 })
      return roomRecord(room).connect(request)
    }
    return new Response('Not Found', { status: 404 })
  }
}
