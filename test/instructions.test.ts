/**
 * The server instructions: what geenee tells the model when a Host connects.
 */
import { describe, expect, it } from 'vitest'
import { geenee } from './connector.ts'

describe('the server instructions', () => {
  it('answer as geenee and say what each Viewer is for, by the prefix of its tools', async () => {
    const { serverInfo, instructions } = await geenee().initialize()

    expect(serverInfo.name).toBe('geenee')
    expect(instructions).toMatch(/igv_[^.]*genome browser/)
    expect(instructions).toMatch(/juicebox_[^.]*contact map/)
    expect(instructions).toMatch(/spacewalk_[^.]*3D viewer/)
  })

  it('give the rule for a request that fits more than one Viewer: the one last used that can do it, and ask only when none was', async () => {
    const { instructions } = await geenee().initialize()

    expect(instructions).toContain('use the viewer this conversation last used that can do it')
    expect(instructions).toContain('ask which one is meant only when none of those has been used')
  })

  it('speak of three Viewers, never of two or both', async () => {
    const { instructions } = await geenee().initialize()

    expect(instructions).toContain('three viewers')
    expect(instructions).not.toMatch(/\b(two|both) viewers\b/i)
    expect(instructions).toMatch(/IGV, Juicebox and Spacewalk tabs/)
  })

  it('fit what Hosts read: the opening rule in the first 512 characters, and all of it in 2,048', async () => {
    const { instructions } = await geenee().initialize()

    expect(instructions!.slice(0, 512)).toContain('open_geenee')
    expect(instructions!.slice(0, 512)).toContain('room')
    expect(instructions!.length).toBeLessThanOrEqual(2048)
  })

  it('are given whether or not the Upstreams can be reached', async () => {
    const { initialize, igv, juicebox } = geenee()
    igv.unreachable = true
    juicebox.unreachable = true

    expect((await initialize()).instructions).toContain('open_geenee')
  })
})
