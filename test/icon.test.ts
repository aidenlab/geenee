/**
 * geenee's icon: the lamp and helix, wherever geenee shows itself (issue #72).
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { GEENEE, geenee } from './connector.ts'

/** A file of the repo, by its path from the root. */
const repoFile = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url).href)

const ICON_FILES = ['favicon.ico', 'icon-128.png', 'icon-512.png', 'apple-touch-icon.png']

describe("geenee's icon", () => {
  it('is served from geenee\'s own origin, as static files', () => {
    for (const file of ICON_FILES) expect(existsSync(repoFile(`public/${file}`))).toBe(true)
  })

  it('is given in serverInfo, on the origin of the geenee that answers', async () => {
    const { serverInfo } = await geenee().initialize()

    expect(serverInfo.icons).toEqual([
      { src: `${GEENEE}/icon-128.png`, mimeType: 'image/png', sizes: ['128x128'] },
      { src: `${GEENEE}/icon-512.png`, mimeType: 'image/png', sizes: ['512x512'] },
    ])
  })

  it('is the tab icon of the Workspace and of geenee\'s own pages', async () => {
    const page = await (await geenee().handle(new Request(`${GEENEE}/get`))).text()
    const workspace = readFileSync(repoFile('index.html'), 'utf8')

    for (const html of [page, workspace]) {
      expect(html).toMatch(/<link rel="icon" href="\/favicon.ico"/)
      expect(html).toMatch(/<link rel="apple-touch-icon" href="\/apple-touch-icon.png"/)
    }
  })

  it('leads the Card\'s message, and heads Show large with geenee\'s name, outside the QR code', async () => {
    const read = await geenee().rpc<{ contents: Array<{ text: string }> }>('resources/read', { uri: 'ui://geenee/open' })

    const card = read.result!.contents[0].text
    expect(card).toContain('<div id="head"><img id="mark" src="data:image/png;base64,')
    expect(card).toContain('<span id="name">geenee</span>')
    expect(card).toContain('body.large #name { display: block; }')
  })
})
