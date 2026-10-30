/**
 * The page review (pages.html, `npm run pages`): every page of the Guest flow,
 * one at a time, at phone and computer size, light and dark. It stands in for
 * the Host so that the Card can be seen outside one, and reads everything from
 * the local Worker, so what it shows is the current code, and reloads when a
 * source changes. Development only: nothing the Worker serves imports this.
 */
import { FONTS, TOKENS } from '../page.ts'

interface ReviewedPage {
  id: string
  name: string
  /** Where to edit it. */
  source: string
  /** Its address; absent for the Card, which only a Host shows. */
  path?: (room: string) => string
  /** The size it opens at, when not a computer's. */
  size?: Size
}

type Size = 'computer' | 'phone'

/** The flow, in the order a Driver and a Guest meet it. */
const PAGES: ReviewedPage[] = [
  { id: 'card', name: 'Card', source: 'src/card.ts' },
  { id: 'hand-off', name: 'Hand-off', source: 'src/handOff.ts', path: (room) => `/h/${room}`, size: 'phone' },
  { id: 'workspace', name: 'Workspace', source: 'src/workspace/', path: (room) => `/r/${room}` },
  { id: 'get', name: 'Get geenee', source: 'src/getGeenee.ts', path: () => '/get' },
  // A Room geenee never opened counts as expired.
  { id: 'expired', name: 'Expired Room', source: 'src/expiredRoom.ts', path: () => '/r/0000000000' },
  { id: 'malformed', name: 'Malformed Room link', source: 'src/malformedRoomLink.ts', path: () => '/r/nope' },
]

const FRAME: Record<Size, { width: string; height: string }> = {
  computer: { width: '100%', height: '100%' },
  phone: { width: '390px', height: '844px' },
}

/** About what a Host's conversation gives the Card on a computer. */
const CARD_FRAME = { width: '640px', height: '480px' }

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const list = element('list')
const source = element('source')
const stage = element('stage')
const alone = element<HTMLAnchorElement>('alone')
const sizeControl = element<HTMLSelectElement>('size')
const themeControl = element<HTMLSelectElement>('theme')
const hostControl = element<HTMLSelectElement>('host')
const hostLabel = document.querySelector<HTMLElement>('.card-only')!

document.head.insertAdjacentHTML('beforeend', `<link rel="stylesheet" href="${FONTS}"><style>${TOKENS}</style>`)

async function mcp(method: string, params: unknown) {
  const reply = await fetch('/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  return (await reply.json()).result
}

// One Room for this load of the page: the Card's, the Hand-off's and the Workspace's.
const [toolResult, cardResource] = await Promise.all([
  mcp('tools/call', { name: 'open_geenee', arguments: {} }),
  mcp('resources/read', { uri: 'ui://geenee/open' }),
])
const room: string = toolResult.structuredContent.room

// The page shown and how, kept in the address so that a reload comes back to it: #hand-off/phone/dark
const [hashId, hashSize, hashTheme] = location.hash.slice(1).split('/')
let current = PAGES.find(({ id }) => id === hashId) ?? PAGES[0]
sizeControl.value = hashSize === 'computer' || hashSize === 'phone' ? hashSize : (current.size ?? 'computer')
themeControl.value = hashTheme === 'dark' ? 'dark' : 'light'

let frame: HTMLIFrameElement | undefined
let displayMode = 'inline'

function hostContext() {
  return {
    theme: themeControl.value,
    platform: hostControl.value === 'desktop' ? 'desktop' : 'web',
    displayMode,
    availableDisplayModes: ['inline', 'fullscreen'],
  }
}

function toCard(message: object): void {
  frame?.contentWindow?.postMessage({ jsonrpc: '2.0', ...message }, '*')
}

function setDisplayMode(mode: string): void {
  displayMode = mode
  document.body.classList.toggle('fullscreen', mode === 'fullscreen')
}

function render(): void {
  const { id, name, path, source: file } = current
  setDisplayMode('inline')
  location.replace(`#${id}/${sizeControl.value}/${themeControl.value}`)
  document.documentElement.dataset.theme = themeControl.value
  source.textContent = file
  for (const button of list.querySelectorAll('button')) button.setAttribute('aria-current', String(button.dataset.id === id))
  hostLabel.hidden = Boolean(path)
  alone.hidden = !path
  if (path) alone.href = path(room)

  const size = sizeControl.value as Size
  const { width, height } = !path && size === 'computer' ? CARD_FRAME : FRAME[size]
  frame = document.createElement('iframe')
  frame.title = name
  frame.style.width = width
  frame.style.height = height
  if (path) {
    frame.src = path(room)
    // The pages' tokens follow data-theme ahead of the system's setting, as the Card's do through the Host's context.
    frame.onload = () => {
      const page = frame?.contentDocument?.documentElement
      if (page) page.dataset.theme = themeControl.value
    }
  }
  else frame.srcdoc = cardResource.contents[0].text
  stage.replaceChildren(frame)
}

// What a Host does for the Card, as far as the Card asks for it.
addEventListener('message', ({ source: sender, data }) => {
  if (sender !== frame?.contentWindow || data?.jsonrpc !== '2.0') return
  const { id, method, params } = data
  if (method === 'ui/initialize') {
    toCard({
      id,
      result: {
        protocolVersion: params.protocolVersion,
        hostInfo: { name: 'geenee pages', version: '0' },
        hostCapabilities: { openLinks: {} },
        hostContext: hostContext(),
      },
    })
  } else if (method === 'ui/notifications/initialized') {
    toCard({ method: 'ui/notifications/tool-result', params: toolResult })
  } else if (method === 'ui/open-link') {
    if (hostControl.value === 'refuses') {
      toCard({ id, result: { isError: true } })
    } else {
      window.open(params.url, '_blank', 'noopener')
      toCard({ id, result: {} })
    }
  } else if (method === 'ui/request-display-mode') {
    setDisplayMode(params.mode)
    toCard({ id, result: { mode: params.mode } })
    toCard({ method: 'ui/notifications/host-context-changed', params: hostContext() })
  } else if (id !== undefined) {
    toCard({ id, result: {} })
  }
})

import.meta.hot?.on('geenee:source-changed', () => location.reload())

for (const reviewed of PAGES) {
  const button = document.createElement('button')
  button.textContent = reviewed.name
  button.dataset.id = reviewed.id
  button.onclick = () => {
    current = reviewed
    sizeControl.value = reviewed.size ?? 'computer'
    render()
  }
  list.append(button)
}
for (const control of [sizeControl, themeControl, hostControl]) control.onchange = render
render()
