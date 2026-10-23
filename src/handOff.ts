/**
 * The Hand-off, the page at /h/<Room id> (#23): where a Room link opened on a
 * phone goes, since geenee is too small to use on one. It shows the Room link
 * and the ways to send it on to a computer: email, the phone's own share sheet,
 * and copy. The Workspace sends a phone here from a Room link (workspace/phone.ts).
 */
import { COPY_SCRIPT, escapeHtml, page } from './page.ts'
import { roomLinkPath } from './roomId.ts'

const EXPIRES = 'Expires after a day without use.'

/** The email a Guest sends themselves: to no one yet, so the mail app asks. */
function emailLink(roomLink: string, getGeenee: string): string {
  const body = [
    'Open this link on a laptop or desktop to join the geenee Room:',
    roomLink,
    '',
    EXPIRES,
    '',
    'geenee shows the igv genome browser and the Juicebox contact-map viewer beside a Claude or ChatGPT conversation.',
    `Get geenee: ${getGeenee}`,
  ].join('\r\n')
  return `mailto:?subject=${encodeURIComponent('Your geenee Room')}&body=${encodeURIComponent(body)}`
}

/** The Hand-off of `room`, a parsed Room id, for the geenee at `origin`. */
export function handOffPage(origin: string, room: string): string {
  const roomLink = new URL(roomLinkPath(room), origin).toString()
  const getGeenee = new URL('/get', origin).toString()
  return page({
    title: 'Your geenee Room',
    style: `
main { padding-top: 8vh; }
.address code { flex-basis: 100%; }
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 1.25rem; }
.actions .button { grid-column: 1 / -1; padding-block: 0.8rem; }
.actions button[hidden] + button { grid-column: 1 / -1; }
.expires { font: 0.9rem var(--sans); color: var(--muted); margin: 1rem 0 0; }
footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.5rem 1.5rem; }
`,
    body: `<main>
  <p class="brand">geenee</p>
  <h1>Send this link to your computer</h1>
  <p class="lede">You've been invited to a live geenee Room. It's built for a laptop or desktop. Email or text yourself the link, then open it there.</p>

  <p class="label" id="link-label">Room link</p>
  <div class="address"><code id="link" aria-labelledby="link-label">${escapeHtml(roomLink)}</code></div>

  <div class="actions">
    <a class="button" href="${escapeHtml(emailLink(roomLink, getGeenee))}">Email me this link</a>
    <button class="quiet" type="button" id="share" hidden>Share…</button>
    <button class="quiet" type="button" data-copy="link">Copy link</button>
  </div>
  <p class="expires">${EXPIRES}</p>

  <footer>
    <a href="/?room=${room}">Open here anyway</a>
    <a href="/get">Get geenee for your own Claude →</a>
  </footer>
</main>
${COPY_SCRIPT}
<script>
  // The phone's own share sheet, which reaches Messages and every other app; hidden where there is none.
  const share = document.getElementById("share");
  if (navigator.share) {
    share.hidden = false;
    share.addEventListener("click", () => {
      navigator.share({ title: "Your geenee Room", text: "Open on a laptop or desktop. ${EXPIRES}", url: document.getElementById("link").textContent }).catch(() => {});
    });
  }
</script>`,
  })
}
