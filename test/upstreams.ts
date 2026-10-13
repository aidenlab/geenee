/**
 * Stand-in Upstreams: a `fetch` that answers for the igv and the Juicebox
 * Upstream's /mcp, listing the tools saved in test/fixtures and recording the
 * tool calls it is sent.
 */
import igvTools from './fixtures/igv-tools.json' with { type: 'json' }
import juiceboxTools from './fixtures/juicebox-tools.json' with { type: 'json' }

export const IGV_UPSTREAM = 'https://igv-upstream.test/mcp'
export const JUICEBOX_UPSTREAM = 'https://juicebox-upstream.test/mcp'

export interface UpstreamReply {
  content: Array<Record<string, unknown>>
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

export interface UpstreamCall {
  name: string
  arguments: Record<string, unknown>
  /** The `mcp-session-id` header the call carried, or null. */
  session: string | null
}

export interface StandInUpstream {
  /** Tool calls received, oldest first. */
  calls: UpstreamCall[]
  /** What a tool call is answered with. */
  reply: (call: UpstreamCall) => UpstreamReply
  /** Set, every tool call is answered with this as a JSON-RPC error, as for arguments the Upstream does not accept. */
  refusal: string | null
  /** True makes every request fail, as for an Upstream that cannot be reached. */
  unreachable: boolean
}

export function standInUpstreams() {
  const standIn = (): StandInUpstream => ({
    calls: [],
    reply: () => ({ content: [{ type: 'text', text: 'Done.' }] }),
    refusal: null,
    unreachable: false,
  })
  const igv = standIn()
  const juicebox = standIn()
  const served: Record<string, { upstream: StandInUpstream; tools: unknown[] }> = {
    [IGV_UPSTREAM]: { upstream: igv, tools: igvTools },
    [JUICEBOX_UPSTREAM]: { upstream: juicebox, tools: juiceboxTools },
  }

  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    const target = served[request.url]
    if (!target) throw new Error(`stand-in Upstreams were asked for ${request.url}`)
    if (target.upstream.unreachable) throw new TypeError('fetch failed')
    const { id, method, params } = (await request.json()) as { id: number; method: string; params: UpstreamCall }
    if (method === 'tools/list') return Response.json({ jsonrpc: '2.0', id, result: { tools: target.tools } })
    if (method === 'tools/call') {
      const call = { name: params.name, arguments: params.arguments, session: request.headers.get('mcp-session-id') }
      target.upstream.calls.push(call)
      if (target.upstream.refusal) return Response.json({ jsonrpc: '2.0', id, error: { code: -32602, message: target.upstream.refusal } })
      return Response.json({ jsonrpc: '2.0', id, result: target.upstream.reply(call) })
    }
    throw new Error(`stand-in Upstreams were sent ${method}`)
  }

  return { igv, juicebox, fetch }
}
