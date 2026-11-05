/**
 * /versions: the version of geenee and of each Upstream behind it (ADR 0004),
 * each Upstream asked as the page loads.
 */
import { describe, expect, it } from 'vitest'
import { GEENEE, geenee } from './connector.ts'

const visit = (connector: ReturnType<typeof geenee>) => connector.handle(new Request(`${GEENEE}/versions`))

describe('the versions page', () => {
  it('is served as a page at /versions', async () => {
    const response = await visit(geenee())

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/html')
    expect(await response.text()).toContain('<title>geenee versions</title>')
  })

  it("gives geenee's own version and the version each Upstream reports", async () => {
    const connector = geenee({ version: 'prod-2026-11-12 (a1b2c3d)' })
    connector.igv.version = 'prod-2026-11-05.2 (4c6e501)'
    connector.juicebox.version = 'view-prod-2026-11-05.1 (ca0393c)'
    connector.spacewalk.version = 'prod-2026-11-05.1 (871af8c)'

    const page = await (await visit(connector)).text()

    expect(page).toContain('prod-2026-11-12 (a1b2c3d)')
    expect(page).toContain('prod-2026-11-05.2 (4c6e501)')
    expect(page).toContain('view-prod-2026-11-05.1 (ca0393c)')
    expect(page).toContain('prod-2026-11-05.1 (871af8c)')
  })

  it('shows an Upstream that does not answer as such, and the others as they report', async () => {
    const connector = geenee()
    connector.juicebox.unreachable = true
    connector.igv.version = 'prod-2026-11-05.2 (4c6e501)'

    const response = await visit(connector)
    const page = await response.text()

    expect(response.status).toBe(200)
    expect(page).toMatch(/<th scope="row">Juicebox<\/th>\s*<td><span class="absent">did not answer<\/span><\/td>/)
    expect(page).toContain('prod-2026-11-05.2 (4c6e501)')
  })

  it('names the address of each Upstream it asked', async () => {
    const page = await (await visit(geenee())).text()

    expect(page).toContain('igv-upstream.test')
    expect(page).toContain('juicebox-upstream.test')
    expect(page).toContain('spacewalk-upstream.test')
  })
})
