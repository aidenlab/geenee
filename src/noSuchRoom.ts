/**
 * The page a Room link with a malformed Room id gets: one plain statement and
 * what to do about it, in the visual language of docs/how-geenee-works.html.
 * Nothing from the address is shown, so the page cannot be made to say anything.
 */
export const NO_SUCH_ROOM_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>No such geenee Room</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400&family=IBM+Plex+Sans:wght@600&family=Source+Serif+4:opsz,wght@8..60,400&display=swap">
<style>
:root {
  --bg: #f5f6f4; --fg: #1b1d1c; --muted: #636966; --rule: #cdd2ce;
  --serif: "Source Serif 4", "Iowan Old Style", Georgia, serif;
  --sans: "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg: #151716; --fg: #e5e7e4; --muted: #9aa19c; --rule: #3b403d; color-scheme: dark; }
}
:root[data-theme="dark"] { --bg: #151716; --fg: #e5e7e4; --muted: #9aa19c; --rule: #3b403d; color-scheme: dark; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 1.0625rem/1.6 var(--serif); }
main { max-width: 32rem; margin-inline: auto; padding: 22vh 16px 4rem; }
p.brand { font: 400 0.85rem var(--mono); color: var(--muted); margin: 0 0 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--rule); }
h1 { font: 600 1.6rem/1.2 var(--sans); letter-spacing: -0.01em; margin: 0 0 0.75rem; text-wrap: balance; }
p { margin: 0; color: var(--muted); }
code { font-family: var(--mono); font-size: 0.9em; }
</style>
</head>
<body>
<main>
  <p class="brand">geenee</p>
  <h1>This link does not name a geenee Room</h1>
  <p>A Room link ends in ten letters and digits, like <code>/r/7ZQH4M2K9X</code>. Check that the whole link was copied, or ask for it again.</p>
</main>
</body>
</html>
`
