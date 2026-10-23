/**
 * Get geenee, the page at /get: what geenee is, and how to add it as a
 * Connector to each Host, with the Connector address ready to copy. The
 * Hand-off, its email and the page of an expired Room link here.
 */
import { COPY_SCRIPT, escapeHtml, page } from './page.ts'

/** The page, for the geenee at `origin`, whose /mcp is the Connector address. */
export function getGeeneePage(origin: string): string {
  const connector = escapeHtml(new URL('/mcp', origin).toString())
  return page({
    title: 'Get geenee',
    description: 'One Connector that lets Claude or ChatGPT drive the igv genome browser and the Juicebox contact-map viewer beside the conversation.',
    style: `
h2 { font: 600 1.0625rem var(--sans); margin: 2.75rem 0 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--fg); }
ol { margin: 0; padding-left: 1.4rem; }
li { margin-bottom: 0.5rem; }
.ui { font: 500 0.92em var(--sans); }
`,
    body: `<main>
  <p class="brand">geenee</p>
  <h1>Get geenee</h1>
  <p class="lede">Ask Claude or ChatGPT to show a genome or a Hi-C contact map, and watch it appear beside the conversation. geenee brings the igv genome browser and the Juicebox contact-map viewer together as one Connector.</p>

  <p class="label" id="address-label">Connector address</p>
  <div class="address">
    <code id="address" aria-labelledby="address-label">${connector}</code>
    <button type="button" data-copy="address">Copy</button>
  </div>

  <h2>Claude</h2>
  <ol>
    <li>In Claude, desktop or on the web, open <span class="ui">Settings → Connectors → Add custom connector</span>.</li>
    <li>Name it <span class="ui">geenee</span> and paste the Connector address as its URL. Leave the OAuth fields blank, and add it.</li>
    <li>In a new conversation, say <q>open geenee</q>.</li>
  </ol>

  <h2>ChatGPT desktop</h2>
  <ol>
    <li>In ChatGPT desktop, in Codex mode, open <span class="ui">Settings → Plugins → Add → Add MCP server</span>.</li>
    <li>Name it <span class="ui">geenee</span>, choose the type <span class="ui">Streamable HTTP</span>, and paste the Connector address as its URL. Leave everything else blank, and save. ChatGPT on the web has no place to add one.</li>
    <li>In a new conversation, say <q>open geenee</q>.</li>
  </ol>

  <footer>Nothing to sign in to. geenee is a proof of concept from the Aiden Lab.</footer>
</main>
${COPY_SCRIPT}`,
  })
}
