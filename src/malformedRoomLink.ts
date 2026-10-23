/**
 * The page a Room link with a malformed Room id gets: one plain statement and
 * what to do about it. Nothing from the address is shown, so the page cannot be
 * made to say anything.
 */
import { page } from './page.ts'

export const MALFORMED_ROOM_LINK_HTML = page({
  title: 'No such geenee Room',
  style: `
main { max-width: 32rem; padding-top: 22vh; }
h1 { font-size: 1.6rem; line-height: 1.2; }
p { margin: 0; color: var(--muted); }
`,
  body: `<main>
  <p class="brand">geenee</p>
  <h1>This link does not name a geenee Room</h1>
  <p>A Room link ends in ten letters and digits, like <code>/r/7ZQH4M2K9X</code>. Check that the whole link was copied, or ask for it again.</p>
</main>`,
})
