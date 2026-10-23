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
import { FONTS, TOKENS } from './page.ts'

export const CARD_URI = 'ui://geenee/open'
export const CARD_MIME_TYPE = 'text/html;profile=mcp-app'

/** Client bundle the Card loads, as in Claude's no-build MCP Apps quickstart. */
const APP_CLIENT = 'https://unpkg.com/@modelcontextprotocol/ext-apps@1.7.5/dist/src/app-with-deps.js'

/** `_meta` for the resource: the sandbox may load the client and the fonts (Google's stylesheet and the font files it names); the QR is a data: image. */
export const CARD_META = { ui: { csp: { resourceDomains: [new URL(APP_CLIENT).origin, new URL(FONTS).origin, 'https://fonts.gstatic.com'] } } }

/** `_meta` for the tool: the current key and the flat one older Hosts read. */
export const TOOL_META = { ui: { resourceUri: CARD_URI }, 'ui/resourceUri': CARD_URI }

export const CARD_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"><title>geenee</title>
<link rel="stylesheet" href="${FONTS}">
<style>
  /* geenee's tokens; the Host's theme, when it gives one, wins over the system's. */${TOKENS}
  :root[data-theme="light"] { color-scheme: light; }
  body { margin: 0; padding: 16px; background: var(--bg); color: var(--fg); font: 1rem/1.5 var(--serif); }
  #text { display: flex; flex-direction: column; gap: 12px; min-width: 200px; }
  #status { text-wrap: pretty; }
  a { align-self: flex-start; font: 0.85rem var(--mono); color: var(--muted); overflow-wrap: anywhere; text-decoration-color: var(--rule); text-underline-offset: 0.15em; }
  a:hover { color: var(--fg); text-decoration-color: currentColor; }
  button {
    align-self: flex-start; padding: 0.6rem 1.1rem; cursor: pointer;
    font: 500 0.95rem var(--sans); color: var(--bg); background: var(--fg); border: 1px solid var(--fg); border-radius: 4px;
  }
  button.quiet { padding: 0.35rem 0.8rem; font-size: 0.85rem; color: var(--fg); background: transparent; border-color: var(--rule); }
  :is(button, a):focus-visible { outline: 2px solid var(--fg); outline-offset: 2px; }
  #code { display: flex; gap: 12px; }
  /* White all round in either theme: the padding is the quiet zone a scanner needs. */
  img { box-sizing: border-box; width: 160px; height: auto; aspect-ratio: 1; padding: 8px; image-rendering: pixelated; background: #fff; border-radius: 4px; }
  #hint { font: 0.85rem/1.45 var(--sans); color: var(--muted); }
  /* Show large: the QR code fills the Card, the Guests' line under it, and the way back. */
  body.large :is(#status, #open, #link) { display: none; }
  body.large :is(#text, #code) { align-items: center; }
  body.large button { align-self: center; }
  body.large #code { flex-direction: column; width: 100%; }
  body.large img { width: min(100%, 36rem); padding: 7%; } /* about four modules of quiet zone */
  :root[data-mode="fullscreen"] body.large img { width: min(100%, calc(100vh - 9rem)); }
  body.large #hint { font-size: 1.1rem; text-align: center; }
</style></head>
<body>
<!-- One message and three ways to open, all shown at once: the button, the link, the QR code. -->
<div id="text">
  <div id="status">Waiting for the geenee link…</div>
  <button id="open" hidden>Open geenee</button>
  <a id="link" href="#" target="_blank" rel="noopener" hidden></a>
  <div id="code"><img id="qr" alt="QR code of the Room link" hidden><button id="large" class="quiet" aria-pressed="false" hidden>Show large</button></div>
  <div id="hint" hidden>Guests: scan to join this Room on your laptop. Expires after a day without use.</div>
</div>
<script type="module">
  import { App } from "${APP_CLIENT}";
  const $ = (id) => document.getElementById(id);
  const app = new App({ name: "geenee", version: "1.0.0" }, { availableDisplayModes: ["inline", "fullscreen"] });
  // workspaceLink opens the Workspace from the button; roomLink, the Room link, is the text link and the QR code.
  let workspaceLink, roomLink, qrPng, openFailed = false;
  // large: the QR code fills the Card; hostMode: how the Host's context last said it shows the Card; granted: the mode the Host gave on request.
  let large = false, hostMode, granted;
  // The Host answers the open request; on a refusal (or no answer) the link and QR are the way in.
  const open = async (e, url) => {
    e?.preventDefault();
    if (!url) return;
    try { openFailed = Boolean((await app.openLink({ url }))?.isError); } catch (err) { openFailed = true; }
    render();
  };
  const hostContext = () => { try { return app.getHostContext?.(); } catch (e) { return undefined; } };
  // Show large fills the whole Card, and the whole window too where the Host offers it.
  const toggleLarge = async () => {
    large = !large;
    if (hostContext()?.availableDisplayModes?.includes("fullscreen")) {
      // The Host's answer counts, should its context lag behind.
      try { granted = (await app.requestDisplayMode({ mode: large ? "fullscreen" : "inline" })).mode; } catch (err) { granted = undefined; /* large within the Card */ }
    }
    render();
  };
  const render = () => {
    const ctx = hostContext();
    if (ctx?.theme) document.documentElement.dataset.theme = ctx.theme;
    // The Host leaving full screen by itself (Escape, its own control) is the way back too.
    const now = ctx?.displayMode;
    if (hostMode === "fullscreen" && now && now !== "fullscreen") { large = false; granted = undefined; }
    hostMode = now ?? hostMode;
    document.documentElement.dataset.mode = large && (granted ?? hostMode) === "fullscreen" ? "fullscreen" : "inline";
    if (!workspaceLink) return;
    const desktop = ctx?.platform === "desktop";
    $("status").textContent = openFailed
      ? "Could not open geenee from here: use the link below or scan the code."
      : desktop
      ? "geenee should open in the panel on the right; if it does not, press Open geenee. If asked, choose to always allow this website."
      : "geenee is ready.";
    $("open").hidden = false;
    $("link").textContent = roomLink; $("link").href = roomLink; $("link").hidden = false;
    if (qrPng) { $("qr").src = "data:image/png;base64," + qrPng; $("qr").hidden = false; $("large").hidden = false; $("hint").hidden = false; }
    document.body.classList.toggle("large", large);
    $("large").textContent = large ? "Show small" : "Show large"; $("large").ariaPressed = String(large);
  };
  app.ontoolresult = ({ structuredContent: sc, content }) => {
    workspaceLink = sc?.workspaceUrl ?? content?.find((c) => c.type === "text")?.text.match(/https?:\\/\\/\\S+/)?.[0];
    if (!workspaceLink) { $("status").textContent = "No geenee link in the tool result."; return; }
    roomLink = sc?.roomUrl ?? workspaceLink;
    qrPng = sc?.qrPng;
    render();
  };
  app.onhostcontextchanged = render;
  // The link opens through the Host too: the Card's sandbox does not let a plain link open a window.
  $("open").onclick = (e) => open(e, workspaceLink); $("link").onclick = (e) => open(e, roomLink);
  $("large").onclick = toggleLarge;
  await app.connect();
  render();
</script>
</body></html>`
