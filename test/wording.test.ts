/**
 * geenee's own wording: the open_geenee description, its result, and the
 * server instructions, taken together.
 */
import { describe, expect, it } from 'vitest'
import { geenee } from './connector.ts'

describe("geenee's own wording", () => {
  // UI automation tools of particular Hosts: geenee names the behaviour, not these.
  const HOST_TOOL_NAMES = /cua_repl|computer[_-]use|Claude_Browser|claude-in-chrome|preview_start/i

  it('names no Host-specific tool, in the open_geenee description, its result, or the server instructions', async () => {
    const { initialize, listTools, callTool } = geenee()

    const { instructions } = await initialize()
    const [openGeenee] = await listTools()
    const [text] = (await callTool('open_geenee')).content

    expect(instructions).not.toMatch(HOST_TOOL_NAMES)
    expect(openGeenee.description).not.toMatch(HOST_TOOL_NAMES)
    expect(text.text).not.toMatch(HOST_TOOL_NAMES)
  })
})
