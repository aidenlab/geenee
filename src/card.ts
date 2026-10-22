/**
 * The Card: the MCP App view (SEP-1865) for open_geenee, copied from the
 * Juicebox Upstream's view with geenee in its place. Hosts that render MCP Apps
 * show it in the conversation; the others ignore the metadata and use the text
 * link. The button opens the link through the Host (`ui/open-link`), which
 * decides where it lands; opening beside the conversation by itself is left to
 * the model's in-app browser, since a Card-side open without a click lands in
 * the user's own browser. The Workspace itself is not framed here: Claude's
 * sandbox forbids framing other origins.
 */

export const CARD_URI = 'ui://geenee/open'
export const CARD_MIME_TYPE = 'text/html;profile=mcp-app'

/** Client bundle the Card loads, as in Claude's no-build MCP Apps quickstart. */
const APP_CLIENT = 'https://unpkg.com/@modelcontextprotocol/ext-apps@1.7.5/dist/src/app-with-deps.js'

/** `_meta` for the resource: the sandbox may load the client; the QR is a data: image. */
export const CARD_META = { ui: { csp: { resourceDomains: [new URL(APP_CLIENT).origin] } } }

/** `_meta` for the tool: the current key and the flat one older Hosts read. */
export const TOOL_META = { ui: { resourceUri: CARD_URI }, 'ui/resourceUri': CARD_URI }

export const CARD_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"><title>geenee</title>
<style>
  body { font: 15px system-ui, sans-serif; margin: 0; padding: 12px; }
  img { width: 160px; height: 160px; image-rendering: pixelated; background: #fff; border-radius: 6px; }
  #text { display: flex; flex-direction: column; gap: 8px; min-width: 200px; }
  a { word-break: break-all; }
  button { align-self: flex-start; padding: 10px 18px; font: inherit; }
</style></head>
<body>
<!-- One message and three ways to open, all shown at once: the button, the link, the QR code. -->
<div id="text">
  <div id="status">Waiting for the geenee link…</div>
  <button id="open" hidden>Open geenee</button>
  <a id="link" href="#" target="_blank" rel="noopener" hidden></a>
  <div><img id="qr" alt="QR code of the geenee link" hidden></div>
  <div id="hint" hidden>Scan the QR code to open the same room on a phone or another device.</div>
</div>
<script type="module">
  import { App } from "${APP_CLIENT}";
  const $ = (id) => document.getElementById(id);
  const app = new App({ name: "geenee", version: "1.0.0" });
  let link, qrPng, openFailed = false;
  // The Host answers the open request; on a refusal (or no answer) the link and QR are the way in.
  const open = async (e) => {
    e?.preventDefault();
    if (!link) return;
    try { openFailed = Boolean((await app.openLink({ url: link }))?.isError); } catch (err) { openFailed = true; }
    render();
  };
  const render = () => {
    let ctx;
    try { ctx = app.getHostContext?.(); } catch (e) { ctx = undefined; }
    if (!link) return;
    const desktop = ctx?.platform === "desktop";
    $("status").textContent = openFailed
      ? "Could not open geenee from here: use the link below or scan the code."
      : desktop
      ? "geenee should open in the panel on the right; if it does not, press Open geenee. If asked, choose to always allow this website."
      : "geenee is ready.";
    $("open").hidden = false;
    $("link").textContent = link; $("link").href = link; $("link").hidden = false;
    if (qrPng) { $("qr").src = "data:image/png;base64," + qrPng; $("qr").hidden = false; $("hint").hidden = false; }
  };
  app.ontoolresult = ({ structuredContent: sc, content }) => {
    link = sc?.workspaceUrl ?? content?.find((c) => c.type === "text")?.text.match(/https?:\\/\\/\\S+/)?.[0];
    if (!link) { $("status").textContent = "No geenee link in the tool result."; return; }
    qrPng = sc?.qrPng;
    render();
  };
  app.onhostcontextchanged = render;
  $("open").onclick = open;
  await app.connect();
  render();
</script>
</body></html>`
