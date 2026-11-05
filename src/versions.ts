/**
 * The page at /versions: the version of this geenee and of each Upstream
 * behind it, as each reports it (ADR 0004). An Upstream is reached by an
 * address, not pinned, so this is where the builds behind a Deployment are read.
 */
import { escapeHtml, page } from './page.ts'
import type { Viewer } from './servedTools.ts'

/** One Upstream as /versions shows it: `version` is null when it did not answer. */
export interface UpstreamVersion {
  /** The Viewer it serves. */
  viewer: Viewer['name']
  /** Its /mcp address. */
  address: string
  version: string | null
}

/** The page, for the geenee at `origin` running `version`, in front of `upstreams`. */
export function versionsPage(origin: string, version: string, upstreams: UpstreamVersion[]): string {
  const row = (name: string, address: string, reported: string | null) => `
      <tr>
        <th scope="row">${escapeHtml(name)}</th>
        <td>${reported === null ? '<span class="absent">did not answer</span>' : `<code>${escapeHtml(reported)}</code>`}</td>
        <td><code class="host">${escapeHtml(new URL(address).host)}</code></td>
      </tr>`
  return page({
    title: 'geenee versions',
    description: 'The version of this geenee and of each Upstream behind it.',
    style: `
main { max-width: 42rem; }
table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
th, td { text-align: left; padding: 0.55rem 1rem 0.55rem 0; border-bottom: 1px solid var(--rule); vertical-align: baseline; }
thead th { font: 500 0.8rem var(--sans); color: var(--muted); }
tbody th { font: 600 0.95rem var(--sans); }
td code { overflow-wrap: anywhere; }
.host { color: var(--muted); }
.absent { font: 500 0.9rem var(--sans); color: var(--muted); }
`,
    body: `<main>
  <p class="brand">geenee</p>
  <h1>Versions</h1>
  <p class="lede">What this geenee runs, and what each Upstream behind it reports, asked as this page loaded.</p>
  <table>
    <thead><tr><td></td><th scope="col">Version</th><th scope="col">Address</th></tr></thead>
    <tbody>${row('geenee', origin, version)}${upstreams.map((upstream) => row(upstream.viewer, upstream.address, upstream.version)).join('')}
    </tbody>
  </table>
  <footer>Each version is a tag or branch and its commit. Reload to ask again.</footer>
</main>`,
  })
}
