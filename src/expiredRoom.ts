/**
 * The page an expired Room's link gets, on a computer and on a phone (ADR
 * 0003): one plain statement, and the way to get geenee. Nothing from the
 * address is shown.
 */
import { page } from './page.ts'

export const EXPIRED_ROOM_HTML = page({
  title: 'This geenee Room has expired',
  style: `
main { max-width: 32rem; padding-top: 22vh; }
h1 { font-size: 1.6rem; line-height: 1.2; }
p { margin: 0; color: var(--muted); }
.action { margin-top: 1.75rem; }
`,
  body: `<main>
  <p class="brand">geenee</p>
  <h1>This Room has expired</h1>
  <p>A geenee Room expires after a day without use, and what it showed is gone with it. Ask for a new link, or get geenee to open a Room of your own.</p>
  <p class="action"><a class="button" href="/get">Get geenee</a></p>
</main>`,
})
