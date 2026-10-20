/**
 * The Workspace: the one geenee page a person opens beside the conversation
 * (ADR 0002). It frames the igv Viewer and the Juicebox Viewer, loads both when
 * it opens, and shows one at a time: the one a tool was last called for, until
 * a person picks the other with a tab. Each tab carries a mark showing whether
 * its Viewer is connected.
 */
import type { ViewerKey, ViewerUsed } from '../workspaceChannel.ts'
import './workspace.css'

const VIEWERS: Record<ViewerKey, string> = { igv: 'igv', juicebox: 'Juicebox' }

/** How often the Workspace asks whether each Viewer is connected. */
const CONNECTIONS_EVERY_MS = 4000

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

function mark(viewer: ViewerKey, connected: boolean): void {
  const element = document.querySelector<HTMLElement>(`.tab[data-viewer="${viewer}"] .mark`)!
  element.classList.toggle('connected', connected)
  element.title = element.ariaLabel = connected ? 'connected' : 'not connected'
}

/**
 * Keeps the mark on each tab to what geenee says of its Viewer (GET
 * /connections), asking again a while after each answer. When geenee cannot be
 * asked, neither Viewer is known to be connected.
 */
async function watchConnections(room: string): Promise<void> {
  let connections: Partial<Record<ViewerKey, boolean>> = {}
  try {
    // A Workspace nobody is looking at keeps its marks as they were.
    if (document.hidden) return
    const response = await fetch(`/connections?room=${encodeURIComponent(room)}`)
    if (!response.ok) throw new Error(`/connections answered ${response.status}`)
    connections = await response.json()
  } catch (error) {
    console.warn('[workspace] could not learn which Viewers are connected:', error)
  } finally {
    if (!document.hidden) for (const viewer of Object.keys(VIEWERS) as ViewerKey[]) mark(viewer, connections[viewer] === true)
    setTimeout(() => void watchConnections(room), CONNECTIONS_EVERY_MS)
  }
}

/**
 * Joins the Room's channel from geenee and brings forward the Viewer each
 * report names. When the socket drops it joins again, waiting 1 s, 2 s, … up
 * to 5 s between attempts. A Room repeats its last report to a Workspace that
 * joins, so one already acted on is left alone: the tab a person has clicked
 * since stays picked until the next tool call.
 */
function followConversation(room: string): void {
  let actedOn = 0
  let failedAttempts = 0
  function join(): void {
    const address = new URL(`/ws?room=${encodeURIComponent(room)}`, location.href)
    address.protocol = address.protocol === 'https:' ? 'wss:' : 'ws:'
    const socket = new WebSocket(address)
    socket.onopen = () => (failedAttempts = 0)
    socket.onmessage = (event) => {
      let message: ViewerUsed
      try {
        message = JSON.parse(String(event.data))
      } catch {
        return // not ours; ignored
      }
      if (message?.type !== 'viewerUsed' || !(message.viewer in VIEWERS) || message.count === actedOn) return
      actedOn = message.count
      show(message.viewer)
    }
    socket.onclose = () => setTimeout(join, Math.min(++failedAttempts, 5) * 1000)
  }
  join()
}

async function open(): Promise<void> {
  const viewers = Object.keys(VIEWERS) as ViewerKey[]
  for (const viewer of viewers) mark(viewer, false)
  const room = new URLSearchParams(location.search).get('room')
  if (!room) {
    for (const viewer of viewers) say(viewer, 'geenee is opened from a conversation: ask for "open geenee" there.')
    return
  }
  followConversation(room)
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
  void watchConnections(room)
}

/**
 * Shows a deployed build's number and its Connector's address at the right end
 * of the tab bar, so a person testing it can tell which build is live and what
 * to add as a connector. The Worker serves both, so the Connector is this
 * page's /mcp. `npm run dev` has no build number, and shows none.
 */
function showBuild(): void {
  const build = import.meta.env.VITE_BUILD
  if (!build) return
  const label = document.createElement('p')
  label.className = 'build'
  label.textContent = `Build ${build} · ${new URL('/mcp', location.href)}`
  document.body.append(label)
}

for (const tab of document.querySelectorAll<HTMLElement>('.tab')) {
  tab.addEventListener('click', () => show(tab.dataset.viewer as ViewerKey))
}
show('igv')
showBuild()
void open()
