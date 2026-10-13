/**
 * One Upstream, as geenee reaches it: JSON-RPC over POST to its /mcp. Both
 * Upstreams are stateless and answer in JSON, so a call needs no handshake.
 */

/** A tool as an Upstream lists it. Fields geenee does not read are passed on as they are. */
export interface Tool {
  name: string
  description?: string
  inputSchema: { properties?: Record<string, unknown>; required?: string[]; [key: string]: unknown }
  [key: string]: unknown
}

export interface ToolResult {
  content: Array<{ type: string; text?: string; [key: string]: unknown }>
  structuredContent?: Record<string, unknown>
  isError?: boolean
  [key: string]: unknown
}

export interface Upstream {
  listTools(): Promise<Tool[]>
  /** Calls a tool by the Upstream's own name for it. `session` is sent as the call's MCP session id. */
  callTool(name: string, args: Record<string, unknown>, session?: string): Promise<ToolResult>
}

/** Longer than either Upstream waits for its Viewer's ack (10 s and 15 s), so a slow Viewer is the Upstream's to report. */
const TIMEOUT_MS = 30_000

export function upstreamAt(address: string, fetch: typeof globalThis.fetch): Upstream {
  let rpcId = 0
  /** The Upstream's answer to one request: its result, or the message of the JSON-RPC error it refused the request with. Throws when it gives no answer. */
  async function rpc<Result>(method: string, params: object, session?: string): Promise<{ result: Result } | { refusal: string }> {
    const response = await fetch(address, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(session ? { 'mcp-session-id': session } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`${address} answered ${method} with ${response.status}`)
    const body = (await response.json()) as { result?: Result; error?: { message?: string } }
    if (body.result !== undefined) return { result: body.result }
    if (body.error) return { refusal: body.error.message ?? 'the request was refused' }
    throw new Error(`${address} answered ${method} with neither a result nor an error`)
  }

  return {
    async listTools() {
      const answer = await rpc<{ tools: Tool[] }>('tools/list', {})
      if ('refusal' in answer) throw new Error(`${address} refused tools/list: ${answer.refusal}`)
      return answer.result.tools
    },
    // A call the Upstream refuses, such as one with arguments it does not accept, is the model's to put right: it gets the Upstream's words as an error reply.
    async callTool(name, args, session) {
      const answer = await rpc<ToolResult>('tools/call', { name, arguments: args }, session)
      return 'refusal' in answer ? { content: [{ type: 'text', text: `Error: ${answer.refusal}` }], isError: true } : answer.result
    },
  }
}
