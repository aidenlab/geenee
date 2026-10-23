/**
 * What geenee's own small pages share (the malformed Room link, the expired
 * Room, Get geenee, the Hand-off): the visual language of docs/how-geenee-works.html, in light and
 * dark, and a Copy button.
 */

export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const STYLE = `
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
h1 { font: 600 2rem/1.15 var(--sans); letter-spacing: -0.01em; margin: 0 0 0.75rem; text-wrap: balance; }
.lede { font-size: 1.2rem; line-height: 1.5; color: var(--muted); margin: 0 0 2.25rem; text-wrap: pretty; }
code { font-family: var(--mono); font-size: 0.9em; }
a { color: inherit; text-decoration-color: var(--rule); text-underline-offset: 0.15em; }
a:hover { text-decoration-color: currentColor; }
.label { font: 500 0.8rem var(--sans); color: var(--muted); margin: 0 0 0.4rem; }
.address { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.address code {
  flex: 1 1 16rem; min-width: 0; padding: 0.6rem 0.75rem;
  font-size: 0.95rem; overflow-wrap: anywhere; user-select: all;
  background: var(--box); border: 1px solid var(--rule); border-radius: 4px;
}
button, a.button {
  box-sizing: border-box; min-width: 6.5rem; padding: 0.6rem 1.1rem; cursor: pointer; text-align: center; text-decoration: none;
  font: 500 0.95rem var(--sans); color: var(--bg); background: var(--fg);
  border: 1px solid var(--fg); border-radius: 4px;
}
button.quiet { color: var(--fg); background: transparent; border-color: var(--rule); }
:is(button, a):focus-visible { outline: 2px solid var(--fg); outline-offset: 2px; }
footer { margin-top: 3rem; padding-top: 0.75rem; border-top: 1px solid var(--rule); font: 0.8rem/1.45 var(--sans); color: var(--muted); }
`

/**
 * Wires each `<button data-copy="<id>">` to copy the text of the element with
 * that id. Where the clipboard is refused, the text is selected for the person
 * to copy.
 */
export const COPY_SCRIPT = `<script>
  for (const button of document.querySelectorAll("button[data-copy]")) {
    const label = button.textContent;
    const text = document.getElementById(button.dataset.copy);
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(text.textContent);
        button.textContent = "Copied";
      } catch {
        getSelection().selectAllChildren(text);
        button.textContent = "Selected";
      }
      setTimeout(() => { button.textContent = label; }, 2000);
    });
  }
</script>`

/** A whole page: `style` adds to the shared style, `body` is what goes in <body>. */
export function page({ title, description, style = '', body }: { title: string; description?: string; style?: string; body: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>${description ? `\n<meta name="description" content="${description}">` : ''}
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400&family=IBM+Plex+Sans:wght@500;600&family=Source+Serif+4:opsz,wght@8..60,400&display=swap">
<style>${STYLE}${style}</style>
</head>
<body>
${body}
</body>
</html>
`
}

/** The response for a page. */
export function pageResponse(html: string, status = 200): Response {
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
