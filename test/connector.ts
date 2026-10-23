/**
 * The Host's side of the Connector: JSON-RPC over POST /mcp on a geenee whose
 * Upstreams and Rooms are stand-ins.
 */
import { createGeenee } from '../src/geenee.ts'
import { IGV_UPSTREAM, JUICEBOX_UPSTREAM, standInUpstreams } from './upstreams.ts'
import { standInRooms } from './workspaces.ts'

export const GEENEE = 'https://geenee.test'

/** What the stand-in serves as the Workspace page. */
export const WORKSPACE_PAGE = '<!doctype html><title>geenee</title>'

export interface Tool {
  name: string
  description: string
  inputSchema: { properties: Record<string, { description?: string }>; required?: string[] }
  _meta?: Record<string, unknown>
}

export interface ToolResult {
  content: Array<{ type: string; text?: string; uri?: string; name?: string; mimeType?: string }>
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

/** A clock that stands still until it is moved on. */
function standInClock() {
  let now = Date.parse('2026-10-23T09:00:00Z')
  return {
    now: () => now,
    advance: (ms: number) => void (now += ms),
  }
}

/** A geenee whose Upstreams, Rooms and clock are stand-ins. `opened` are Rooms open_geenee opened just before. */
export function geenee({ opened = [] }: { opened?: string[] } = {}) {
  const upstreams = standInUpstreams()
  const rooms = standInRooms()
  const clock = standInClock()
  for (const room of opened) rooms.start(room, clock.now())
  const handle = createGeenee({
    igvUpstream: IGV_UPSTREAM,
    juiceboxUpstream: JUICEBOX_UPSTREAM,
    fetch: upstreams.fetch,
    roomRecord: (room) => rooms.roomRecord(room),
    now: clock.now,
    workspacePage: async () => new Response(WORKSPACE_PAGE, { headers: { 'Content-Type': 'text/html' } }),
  })

  let rpcId = 0
  async function rpc<Result>(method: string, params: object = {}) {
    const response = await handle(
      new Request(`${GEENEE}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
      }),
    )
    return (await response.json()) as { result?: Result; error?: { code: number; message: string } }
  }

  return {
    ...upstreams,
    rooms,
    clock,
    openWorkspace: (room: string) => rooms.openWorkspace(room),
    handle,
    rpc,
    async initialize() {
      const params = { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '0' } }
      return (await rpc<{ instructions?: string; serverInfo: { name: string } }>('initialize', params)).result!
    },
    async listTools() {
      return (await rpc<{ tools: Tool[] }>('tools/list')).result!.tools
    },
    async callTool(name: string, args: object = {}) {
      return (await rpc<ToolResult>('tools/call', { name, arguments: args })).result!
    },
  }
}
