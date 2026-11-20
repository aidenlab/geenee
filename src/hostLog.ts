/**
 * Which Host is connecting, for the Worker's log (wrangler tail), kept on dev
 * and prod so that a problem in one Host can be told from one in another: on
 * initialize, the Host's name and version and whether it declares MCP Apps
 * (the `io.modelcontextprotocol/ui` extension), so can draw the Card; on every
 * MCP request, its User-Agent. Nothing the conversation says is logged: only
 * the method of each message, and clientInfo of an initialize.
 */

/** The MCP Apps extension a Host declares in its capabilities when it renders `ui://` resources such as the Card. */
const UI_EXTENSION = 'io.modelcontextprotocol/ui'

interface Message {
  method?: unknown
  params?: { clientInfo?: { name?: unknown; version?: unknown }; capabilities?: { extensions?: Record<string, unknown> } }
}

/** One message's part of the line: its method, and for an initialize the Host and whether it declares MCP Apps. */
function partOfLine(message: Message): string {
  const method = typeof message?.method === 'string' ? message.method : 'response'
  if (method !== 'initialize') return method
  const { name, version } = message.params?.clientInfo ?? {}
  const ui = message.params?.capabilities?.extensions?.[UI_EXTENSION] !== undefined
  return `initialize | ${String(name ?? 'unnamed')} ${String(version ?? '')}`.trimEnd() + ` | MCP Apps: ${ui ? 'yes' : 'no'}`
}

/** Logs one line for a POST to /mcp. Reads a copy of the body, so the request is left for the transport. */
export async function logHost(request: Request): Promise<void> {
  const userAgent = request.headers.get('User-Agent') || 'none'
  let what: string
  try {
    const body = (await request.clone().json()) as Message | Message[]
    what = (Array.isArray(body) ? body : [body]).map(partOfLine).join(', ')
  } catch {
    what = 'unreadable'
  }
  console.log(`[host] ${what} | User-Agent: ${userAgent}`)
}
