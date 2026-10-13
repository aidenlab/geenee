/**
 * geenee is only as available as its Upstreams: when one cannot be reached,
 * the other's tools are still served (ADR 0001).
 */
import { describe, expect, it } from 'vitest'
import { geenee } from './connector.ts'

const ROOM = '7ZQH4M2K9X'

describe('with the igv Upstream unreachable', () => {
  it('still lists open_geenee and the Juicebox tools', async () => {
    const { listTools, igv } = geenee()
    igv.unreachable = true

    const names = (await listTools()).map((tool) => tool.name)

    expect(names).toHaveLength(31)
    expect(names[0]).toBe('open_geenee')
    expect(names.filter((name) => name.startsWith('igv_'))).toEqual([])
  })

  it('still forwards a call to a Juicebox tool', async () => {
    const { callTool, igv, juicebox } = geenee()
    igv.unreachable = true

    const result = await callTool('juicebox_zoom_in', { room: ROOM })

    expect(result).toEqual({ content: [{ type: 'text', text: 'Done.' }] })
    expect(juicebox.calls).toHaveLength(1)
  })

  it('answers a call to an igv tool by saying the igv Viewer cannot be reached', async () => {
    const { callTool, igv } = geenee()
    igv.unreachable = true

    const result = await callTool('igv_zoom_in', { room: ROOM })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe(
      'Error: geenee could not reach the server of the igv viewer, so igv_zoom_in was not sent. The Juicebox tools are not affected. Try again in a moment.',
    )
  })
})

describe('with the Juicebox Upstream unreachable', () => {
  it('still lists open_geenee and the igv tools', async () => {
    const { listTools, juicebox } = geenee()
    juicebox.unreachable = true

    const names = (await listTools()).map((tool) => tool.name)

    expect(names).toHaveLength(14)
    expect(names.filter((name) => name.startsWith('juicebox_'))).toEqual([])
  })

  it('answers a call to a Juicebox tool by saying the Juicebox Viewer cannot be reached', async () => {
    const { callTool, juicebox } = geenee()
    juicebox.unreachable = true

    const result = await callTool('juicebox_zoom_in', { room: ROOM })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe(
      'Error: geenee could not reach the server of the Juicebox viewer, so juicebox_zoom_in was not sent. The igv tools are not affected. Try again in a moment.',
    )
  })
})
