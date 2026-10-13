/**
 * The combined tool list the Connector serves, against the Upstreams' saved tool lists.
 */
import { describe, expect, it } from 'vitest'
import { geenee } from './connector.ts'
import igvTools from './fixtures/igv-tools.json' with { type: 'json' }
import juiceboxTools from './fixtures/juicebox-tools.json' with { type: 'json' }

describe('the combined tool list', () => {
  it('serves each Upstream tool under a name prefixed with its Viewer', async () => {
    const names = (await geenee().listTools()).map((tool) => tool.name)

    expect(names).toContain('igv_zoom_in')
    expect(names).toContain('juicebox_zoom_in')
    expect(names).toContain('igv_go_to_locus')
    expect(names).toContain('juicebox_goto_locus')
    expect(names).not.toContain('zoom_in')
  })

  it('leaves alone a name that already says which Viewer it belongs to', async () => {
    const names = (await geenee().listTools()).map((tool) => tool.name)

    expect(names).toContain('juicebox_help')
    expect(names).not.toContain('juicebox_juicebox_help')
  })

  it("leaves out each Upstream's own open tool and Juicebox's join_room", async () => {
    const names = (await geenee().listTools()).map((tool) => tool.name)

    expect(names.filter((name) => /open_viewer|get_juicebox_url|join_room/.test(name))).toEqual([])
    expect(names.filter((name) => name.startsWith('igv_'))).toHaveLength(13)
    expect(names.filter((name) => name.startsWith('juicebox_'))).toHaveLength(30)
  })

  it('gives every tool a required room argument, including Juicebox tools whose Upstream versions take none', async () => {
    const tools = await geenee().listTools()

    const roomOptional = tools.filter((tool) => tool.name !== 'open_geenee' && !tool.inputSchema.required?.includes('room'))
    expect(roomOptional.map((tool) => tool.name)).toEqual([])
    // Arguments the Upstream requires stay required.
    expect(tools.find((tool) => tool.name === 'juicebox_load_map')!.inputSchema.required).toEqual(['url', 'room'])

    const withoutRoom = tools.filter((tool) => !tool.inputSchema.properties.room).map((tool) => tool.name)
    expect(withoutRoom).toEqual([])
    const zoomIn = tools.find((tool) => tool.name === 'juicebox_zoom_in')!
    expect(Object.keys(zoomIn.inputSchema.properties).sort()).toEqual(['centerX', 'centerY', 'panel', 'room'])
    expect(zoomIn.inputSchema.properties.room.description).toContain('open_geenee')
  })

  it('names tools in descriptions by the names it serves', async () => {
    const tools = await geenee().listTools()
    const described = (name: string) => tools.find((tool) => tool.name === name)!

    // igv: "or call read_session_summary first"
    expect(described('igv_remove_track').description).toContain('or call igv_read_session_summary first')
    // Juicebox: "pass `maps[].url` to load_map"
    expect(described('juicebox_search_encode_hic').description).toMatch(/to juicebox_load_map\b/)
    // A name inside an argument's description: "as given in the reply of open_viewer".
    expect(described('igv_zoom_in').inputSchema.properties.room.description).toContain('the reply of open_geenee')
  })

  it('leaves no Upstream tool name in any description', async () => {
    const tools = await geenee().listTools()

    // Every Upstream name is the tail of the name geenee serves, so a served name with its prefix taken off must not be left standing alone.
    const upstreamNames = [...igvTools, ...juiceboxTools].map((tool) => tool.name).filter((name) => name !== 'juicebox_help')
    const leftStanding = new RegExp(`(?<![A-Za-z0-9_])(${upstreamNames.join('|')})(?![A-Za-z0-9_])`)
    const stillNamed = tools.filter((tool) => leftStanding.test(JSON.stringify([tool.description, tool.inputSchema])))
    expect(stillNamed.map((tool) => `${tool.name}: ${leftStanding.exec(JSON.stringify([tool.description, tool.inputSchema]))![0]}`)).toEqual([])
  })
})
