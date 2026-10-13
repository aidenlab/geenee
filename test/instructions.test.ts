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
  })

  it('give the rule for a request that fits both Viewers: the one last used, and ask only when neither was', async () => {
    const { instructions } = await geenee().initialize()

    expect(instructions).toContain('use the viewer this conversation last used')
    expect(instructions).toContain('ask which one is meant only when neither has been used')
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
