/**
 * The Workspace: the one geenee page a person opens beside the conversation
 * (ADR 0002). It frames the igv Viewer and the Juicebox Viewer, loads both when
 * it opens, and shows one at a time, picked with a tab.
 */
import './workspace.css'

const VIEWERS = { igv: 'igv', juicebox: 'Juicebox' } as const
type ViewerKey = keyof typeof VIEWERS

/** What GET /viewers answers: each Viewer's Join link for the Room, null when its Upstream gave none. */
type JoinLinks = Record<ViewerKey, string | null>

function panel(viewer: ViewerKey): HTMLElement {
  return document.querySelector<HTMLElement>(`.viewer[data-viewer="${viewer}"]`)!
}

/** Brings one Viewer forward. The other stays loaded behind it, so that it keeps receiving commands. */
function show(shown: ViewerKey): void {
  for (const tab of document.querySelectorAll<HTMLElement>('.tab')) {
    tab.setAttribute('aria-selected', String(tab.dataset.viewer === shown))
  }
  for (const viewer of Object.keys(VIEWERS) as ViewerKey[]) panel(viewer).classList.toggle('shown', viewer === shown)
}

function say(viewer: ViewerKey, message: string): void {
  const note = document.createElement('p')
  note.className = 'note'
  note.textContent = message
  panel(viewer).replaceChildren(note)
}

function frame(viewer: ViewerKey, joinLink: string): void {
  const iframe = document.createElement('iframe')
  iframe.title = `${VIEWERS[viewer]} viewer`
  iframe.allow = 'clipboard-write'
  iframe.src = joinLink
  panel(viewer).replaceChildren(iframe)
}

async function open(): Promise<void> {
  const viewers = Object.keys(VIEWERS) as ViewerKey[]
  const room = new URLSearchParams(location.search).get('room')
  if (!room) {
    for (const viewer of viewers) say(viewer, 'geenee is opened from a conversation: ask for "open geenee" there.')
    return
  }
  let links: JoinLinks
  try {
    const response = await fetch(`/viewers?room=${encodeURIComponent(room)}`)
    if (!response.ok) throw new Error(`/viewers answered ${response.status}`)
    links = await response.json()
  } catch (error) {
    console.error('[workspace] could not learn the Viewers of this Room:', error)
    for (const viewer of viewers) say(viewer, 'geenee could not open this Room. Ask for "open geenee" again in the conversation.')
    return
  }
  for (const viewer of viewers) {
    const joinLink = links[viewer]
    if (joinLink) frame(viewer, joinLink)
    else say(viewer, `The ${VIEWERS[viewer]} viewer could not be reached. Reload this page to try again.`)
  }
}

for (const tab of document.querySelectorAll<HTMLElement>('.tab')) {
  tab.addEventListener('click', () => show(tab.dataset.viewer as ViewerKey))
}
show('igv')
void open()
