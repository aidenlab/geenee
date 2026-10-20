/**
 * geenee: the Connector at /mcp, forwarding to the two Upstreams (ADR 0001).
 *
 * Routes:
 *   POST /mcp     - MCP protocol (stateless Streamable HTTP, JSON responses)
 *   GET  /mcp     - 405 (no SSE stream)
 *   OPTIONS /mcp  - CORS preflight
 *   GET  /viewers?room= - the address of each Viewer in a Room, for the Workspace
 *   GET  /connections?room= - whether each Viewer is connected in a Room, for the marks on the Workspace's tabs
 *   GET  /ws?room= - WebSocket upgrade → the Room's Durable Object (Workspaces)
 *
 * The Workspace page itself is a static asset, served beside this.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js'
import { INSTRUCTIONS } from './instructions.ts'
import { OPEN_GEENEE_TOOL, openGeenee } from './openGeenee.ts'
import { mintRoomId, parseRoomId } from './roomId.ts'
import { IGV, JUICEBOX, OPEN_GEENEE, serveTools, type Viewer } from './servedTools.ts'
import { upstreamAt, type ToolResult, type Upstream } from './upstream.ts'
import type { ViewerKey } from './workspaceChannel.ts'

/** geenee's channel to the Workspaces of one Room. */
export interface WorkspaceChannel {
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
  /** The channel to the Workspaces of a Room, by Room id; the tests pass stand-ins. */
  channelTo: (room: string) => WorkspaceChannel
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

/** The Viewer an open_geenee call names, undefined when it names none. An empty string is an argument left out, as for a Room. */
function viewerNamed(viewer: unknown): { viewer: Viewer } | { refusal: ToolResult } | undefined {
  if (viewer === undefined || viewer === null || (typeof viewer === 'string' && viewer.trim() === '')) return undefined
  const key = typeof viewer === 'string' ? viewer.trim().toLowerCase() : null
  const named = [IGV, JUICEBOX].find(({ prefix }) => prefix === key)
  if (named) return { viewer: named }
  return { refusal: errorReply(`${JSON.stringify(viewer)} is not a viewer. Pass ${IGV.prefix} or ${JUICEBOX.prefix}, or leave viewer out.`) }
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
  workspaces: WorkspaceChannel,
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
  return served.reply(result, room)
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

export function createGeenee({ igvUpstream, juiceboxUpstream, fetch, channelTo }: GeeneeConfig): (request: Request) => Promise<Response> {
  const targets: Target[] = [
    { viewer: IGV, upstream: upstreamAt(igvUpstream, fetch) },
    { viewer: JUICEBOX, upstream: upstreamAt(juiceboxUpstream, fetch) },
  ]

  /** Workers are stateless, so every request gets a fresh server and transport, as in both Upstreams. */
  async function handleMcpRequest(request: Request): Promise<Response> {
    const server = new Server({ name: 'geenee', version: '0.0.0' }, { capabilities: { tools: {} }, instructions: INSTRUCTIONS })
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
        const named = viewerNamed(args.viewer)
        if (named && 'refusal' in named) return named.refusal
        const id = room?.id ?? mintRoomId()
        // Through the same path as a tool call, so the Viewer is in front, and last used, from the start. A Workspace that is not told still has its tabs.
        if (named) {
          await channelTo(id)
            .viewerUsed(named.viewer.prefix)
            .catch((error) => console.warn(`[mcp] ${name} | the Workspaces of Room ${id} could not be told:`, error))
        }
        return openGeenee(new URL(request.url).origin, id, named?.viewer)
      }

      const target = targets.find(({ viewer }) => name.startsWith(`${viewer.prefix}_`))
      if (!target) throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${name}`)
      if (!room) {
        return errorReply(
          `${name} was called without room. Call ${OPEN_GEENEE} first if geenee is not open yet, then pass the Room id from its reply as room.`,
        )
      }
      let result: ToolResult | undefined
      try {
        result = await forward(target, name, args, room.id, channelTo(room.id))
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
      const links = await Promise.all(targets.map(async (target) => [target.viewer.prefix, await joinLink(target, room)]))
      return Response.json(Object.fromEntries(links))
    }
    if (url.pathname === '/connections' && request.method === 'GET') {
      const room = parseRoomId(url.searchParams.get('room') ?? '')
      if (!room) return new Response('Missing or malformed room', { status: 400 })
      const connected = await Promise.all(targets.map(async (target) => [target.viewer.prefix, await isConnected(target, room)]))
      return Response.json(Object.fromEntries(connected))
    }
    if (url.pathname === '/ws' && request.headers.get('Upgrade') === 'websocket') {
      const room = parseRoomId(url.searchParams.get('room') ?? '')
      if (!room) return new Response('Missing or malformed room', { status: 400 })
      return channelTo(room).connect(request)
    }
    return new Response('Not Found', { status: 404 })
  }
}
