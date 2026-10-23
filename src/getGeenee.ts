/**
 * Get geenee, the page at /get: what geenee is, and how to add it as a
 * Connector to each Host, with the Connector address ready to copy. In the
 * visual language of docs/how-geenee-works.html. For the Hand-off, its email,
 * and the page of an expired Room to link to.
 */

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** The page, for the geenee at `origin`, whose /mcp is the Connector address. */
export function getGeeneePage(origin: string): string {
  const connector = escapeHtml(new URL('/mcp', origin).toString())
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Get geenee</title>
<meta name="description" content="One Connector that lets Claude or ChatGPT drive the igv genome browser and the Juicebox contact-map viewer beside the conversation.">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400&family=IBM+Plex+Sans:wght@500;600&family=Source+Serif+4:opsz,wght@8..60,400&display=swap">
<style>
:root {
  --bg: #f5f6f4; --box: #ffffff; --fg: #1b1d1c; --muted: #636966; --rule: #cdd2ce;
  --serif: "Source Serif 4", "Iowan Old Style", Georgia, serif;
  --sans: "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg: #151716; --box: #1e2120; --fg: #e5e7e4; --muted: #9aa19c; --rule: #3b403d; color-scheme: dark; }
}
:root[data-theme="dark"] { --bg: #151716; --box: #1e2120; --fg: #e5e7e4; --muted: #9aa19c; --rule: #3b403d; color-scheme: dark; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 1.0625rem/1.6 var(--serif); }
main {
  max-width: 34rem; margin-inline: auto;
  padding: 12vh max(16px, env(safe-area-inset-right, 0px)) 4rem max(16px, env(safe-area-inset-left, 0px));
}
p.brand { font: 400 0.85rem var(--mono); color: var(--muted); margin: 0 0 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--rule); }
h1 { font: 600 2rem/1.15 var(--sans); letter-spacing: -0.01em; margin: 0 0 0.75rem; }
.lede { font-size: 1.2rem; line-height: 1.5; color: var(--muted); margin: 0 0 2.25rem; text-wrap: pretty; }
h2 { font: 600 1.0625rem var(--sans); margin: 2.75rem 0 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--fg); }
.label { font: 500 0.8rem var(--sans); color: var(--muted); margin: 0 0 0.4rem; }
.address { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.address code {
  flex: 1 1 16rem; min-width: 0; padding: 0.6rem 0.75rem;
  font: 400 0.95rem var(--mono); overflow-wrap: anywhere; user-select: all;
  background: var(--box); border: 1px solid var(--rule); border-radius: 4px;
}
button {
  flex: 0 0 auto; min-width: 6.5rem; padding: 0.6rem 1.1rem; cursor: pointer;
  font: 500 0.95rem var(--sans); color: var(--bg); background: var(--fg);
  border: 1px solid var(--fg); border-radius: 4px;
}
button:focus-visible, a:focus-visible { outline: 2px solid var(--fg); outline-offset: 2px; }
ol { margin: 0; padding-left: 1.4rem; }
li { margin-bottom: 0.5rem; }
.ui { font: 500 0.92em var(--sans); }
footer { margin-top: 3rem; padding-top: 0.75rem; border-top: 1px solid var(--rule); font: 0.8rem/1.45 var(--sans); color: var(--muted); }
</style>
</head>
<body>
<main>
  <p class="brand">geenee</p>
  <h1>Get geenee</h1>
  <p class="lede">Ask Claude or ChatGPT to show a genome or a Hi-C contact map, and watch it appear beside the conversation. geenee brings the igv genome browser and the Juicebox contact-map viewer together as one Connector.</p>

  <p class="label" id="address-label">Connector address</p>
  <div class="address">
    <code id="address" aria-labelledby="address-label">${connector}</code>
    <button id="copy" type="button">Copy</button>
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
<script>
  const copy = document.getElementById("copy");
  const address = document.getElementById("address");
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(address.textContent);
      copy.textContent = "Copied";
    } catch {
      // Where the clipboard is refused, select the address for the person to copy.
      getSelection().selectAllChildren(address);
      copy.textContent = "Selected";
    }
    setTimeout(() => { copy.textContent = "Copy"; }, 2000);
  });
</script>
</body>
</html>
`
}
