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

  it('give the Pane rule in the first 512 characters: open the link there, and do nothing else in it', async () => {
    const { instructions } = await geenee().initialize()
    const opening = instructions!.slice(0, 512)

    expect(opening).toContain('open the geenee link there: that is the only thing you do in that page')
    expect(opening).toContain('Never click, type, scroll, take screenshots, read the page or pick a tab in it')
    expect(opening).toContain('browser or screen automation')
    expect(opening).toContain("everything else goes through geenee's tools")
  })

  it("make a tool's result the check, so the model never looks at the page to confirm", async () => {
    const { instructions } = await geenee().initialize()

    expect(instructions).toContain("A tool's result is the check: it says whether its viewer did it")
    expect(instructions).toContain('never look at the page to confirm')
  })

  it('say geenee brings forward the Viewer of each call by itself, and the tabs are for the person only', async () => {
    const { instructions } = await geenee().initialize()

    expect(instructions).toContain('geenee brings forward the viewer each tool call is for, by itself')
    expect(instructions).toContain('The IGV and Juicebox tabs are for the user, to show the other viewer, never for you')
  })

  it('are given whether or not the Upstreams can be reached', async () => {
    const { initialize, igv, juicebox } = geenee()
    igv.unreachable = true
    juicebox.unreachable = true

    expect((await initialize()).instructions).toContain('open_geenee')
  })
})
