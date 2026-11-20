/**
 * Which Host is connecting, in the Worker's log (wrangler tail), kept on dev
 * and prod: on initialize, the Host's name and version and whether it declares
 * MCP Apps, so draws the Card; on every MCP request, its User-Agent. Never what
 * the conversation says.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { GEENEE, geenee } from './connector.ts'

const UI_EXTENSION = 'io.modelcontextprotocol/ui'

let log: MockInstance<typeof console.log>
beforeEach(() => {
  log = vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => log.mockRestore())

/** The lines geenee logged about the Host. */
const hostLines = () => log.mock.calls.map((args) => args.join(' ')).filter((line) => line.startsWith('[host]'))

function post(body: object, userAgent?: string): Request {
  return new Request(`${GEENEE}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(userAgent ? { 'User-Agent': userAgent } : {}) },
    body: JSON.stringify(body),
  })
}

function initialize(clientInfo: object, capabilities: object = {}) {
  return { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities, clientInfo } }
}

describe('logging the Host', () => {
  it('names the Host and says it declares MCP Apps on initialize', async () => {
    await geenee().handle(post(initialize({ name: 'claude-ai', version: '0.1.0' }, { extensions: { [UI_EXTENSION]: { mimeTypes: ['text/html;profile=mcp-app'] } } })))

    expect(hostLines()).toEqual([expect.stringMatching(/^\[host\] initialize \| claude-ai 0\.1\.0 \| MCP Apps: yes \| /)])
  })

  it('says so when the Host does not declare MCP Apps', async () => {
    await geenee().handle(post(initialize({ name: 'codex-mcp-client', version: '0.98.0' })))

    expect(hostLines()).toEqual([expect.stringMatching(/^\[host\] initialize \| codex-mcp-client 0\.98\.0 \| MCP Apps: no \| /)])
  })

  it('gives the User-Agent of every MCP request', async () => {
    const { handle } = geenee()

    await handle(post(initialize({ name: 'claude-ai', version: '0.1.0' }), 'Claude-User/1.0'))
    await handle(post({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, 'Claude-User/1.0'))
    await handle(post({ jsonrpc: '2.0', method: 'notifications/initialized' }))

    expect(hostLines()).toEqual([
      '[host] initialize | claude-ai 0.1.0 | MCP Apps: no | User-Agent: Claude-User/1.0',
      '[host] tools/list | User-Agent: Claude-User/1.0',
      '[host] notifications/initialized | User-Agent: none',
    ])
  })

  it('logs nothing of what a tool call carries', async () => {
    const { handle } = geenee({ opened: ['7ZQH4M2K9X'] })

    await handle(post({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'igv_go_to_gene', arguments: { gene: 'MYC', room: '7ZQH4M2K9X' } } }, 'openai-mcp/1.0'))

    expect(hostLines()).toEqual(['[host] tools/call | User-Agent: openai-mcp/1.0'])
  })

  it('still answers a request it cannot read', async () => {
    const response = await geenee().handle(new Request(`${GEENEE}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: '{not json' }))

    expect(response.status).toBe(400)
    expect(hostLines()).toEqual(['[host] unreadable | User-Agent: none'])
  })
})
