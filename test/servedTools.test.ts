/**
 * How a Viewer's hidden and withheld tools shape what geenee serves, against a
 * made-up Upstream whose text names both.
 */
import { describe, expect, it } from 'vitest'
import { IGV, JUICEBOX, serveTools } from '../src/servedTools.ts'
import type { Tool } from '../src/upstream.ts'

const UPSTREAM_TOOLS: Tool[] = [
  { name: 'open_viewer', description: 'Opens the Viewer.', inputSchema: { type: 'object' } },
  { name: 'get_shareable_url', description: 'Gives the Shareable URL.', inputSchema: { type: 'object' } },
  {
    name: 'zoom_in',
    description: 'Zooms in. Call open_viewer first; get_shareable_url afterwards gives a link.',
    inputSchema: { type: 'object' },
  },
]

describe("a Viewer's withheld tools", () => {
  it('are not served, and neither are its hidden tools', () => {
    const { tools } = serveTools(IGV, UPSTREAM_TOOLS)

    expect(tools.map(({ tool }) => tool.name)).toEqual(['igv_zoom_in'])
  })

  it('are named as they are in Upstream text, while a hidden tool is named as open_geenee', () => {
    const { tools, reply } = serveTools(IGV, UPSTREAM_TOOLS)

    expect(tools[0].tool.description).toBe('Zooms in. Call open_geenee first; get_shareable_url afterwards gives a link.')
    expect(reply({ content: [{ type: 'text', text: 'Use open_viewer or get_shareable_url.' }] }).content[0].text).toBe(
      'Use open_geenee or get_shareable_url.',
    )
  })
})

describe("a Viewer's hidden tools", () => {
  it("are, for Juicebox, both named as open_geenee, while its create_shareable_url is still served", () => {
    const { tools, reply } = serveTools(JUICEBOX, [
      { name: 'get_juicebox_url', description: 'Gives the join link.', inputSchema: { type: 'object' } },
      { name: 'join_room', description: 'Joins a Room.', inputSchema: { type: 'object' } },
      { name: 'create_shareable_url', description: 'Call get_juicebox_url or join_room first.', inputSchema: { type: 'object' } },
    ])

    expect(tools.map(({ tool }) => tool.name)).toEqual(['juicebox_create_shareable_url'])
    expect(tools[0].tool.description).toBe('Call open_geenee or open_geenee first.')
    expect(reply({ content: [{ type: 'text', text: 'Use join_room.' }] }).content[0].text).toBe('Use open_geenee.')
  })
})
