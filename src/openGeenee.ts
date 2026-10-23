/**
 * open_geenee: geenee's own tool. It opens the Workspace, which holds both
 * Viewers (ADR 0002), and gives the model the one Room id every other tool
 * takes back. It stands in for each Upstream's own open tool, which geenee hides.
 */
import { TOOL_META } from './card.ts'
import { qrPng } from './qrPng.ts'
import { roomLinkPath } from './roomId.ts'
import { OPEN_GEENEE } from './servedTools.ts'
import type { Tool, ToolResult } from './upstream.ts'

export const OPEN_GEENEE_TOOL: Tool = {
  name: OPEN_GEENEE,
  // Hosts head the Card with this title, as "Opened Get geenee link".
  title: 'Get geenee link',
  description:
    'Get the link that opens geenee: one page beside the conversation holding the igv genome browser and the Juicebox contact-map viewer. Use this before any other geenee tool, and when the user asks to open geenee, IGV, a genome browser, Juicebox or a contact map, or greets any of them ("hello geenee", "hi igv", "hello juicebox"): call this tool straight away instead of only greeting back. One call opens both viewers; there is no separate tool to open either. If you have a browser that shows pages inside this app, beside the conversation, open the link in it right away: both viewers connect there and later tool calls redraw them. Use only such an in-app browser; a tool that drives the user\'s own web browser is not one, and if there is no in-app browser do not try anything else. The user is shown a Card with an Open geenee button, for when the link is not opened beside the conversation. Do not repeat the link or the Room id in your reply. The result of this tool names the Room id: pass it as room on every later geenee tool call in this conversation.',
  inputSchema: {
    type: 'object',
    properties: {
      room: {
        type: 'string',
        description:
          'Only when geenee was already opened in this conversation: the Room id from that reply of open_geenee, to get the same geenee back, with both viewers showing what they last showed. Leave it out the first time: geenee then opens in a new Room.',
      },
    },
  },
  _meta: TOOL_META,
}

/** The link that opens the Workspace of a Room. `origin` is geenee's own address. */
function workspaceLinkFor(origin: string, room: string): string {
  const link = new URL('/', origin)
  link.searchParams.set('room', room)
  return link.toString()
}

/** The Room link: the short link that brings anyone into a Room, shorter than the Workspace's and so a less dense QR code. */
function roomLinkFor(origin: string, room: string): string {
  return new URL(roomLinkPath(room), origin).toString()
}

/** Opens geenee in `room`, a Room that has not expired. */
export function openGeenee(origin: string, room: string): ToolResult {
  const workspaceLink = workspaceLinkFor(origin, room)
  const roomLink = roomLinkFor(origin, room)
  // The Card's button opens the Workspace's link; its text link and QR code carry the Room link.
  const structuredContent: Record<string, unknown> = { room, workspaceUrl: workspaceLink, roomUrl: roomLink }
  try {
    structuredContent.qrPng = qrPng(roomLink) // drawn by the Card
  } catch (error) {
    console.warn('[open_geenee] no QR code for the Card:', error)
  }
  // A bare URL on its own line: Hosts render it clickable, which a code block
  // would not be. The resource link is the same link for Hosts that render
  // link content blocks.
  return {
    content: [
      {
        type: 'text',
        text: `geenee link:\n${workspaceLink}\n\nRoom id: ${room}. Pass it as room on every later geenee tool call in this conversation, for igv and Juicebox tools alike.\n\nNext step: if you have a browser that shows pages inside this app, beside the conversation, open this link in it now so geenee shows there. Never use a tool that drives the user's own web browser, and if there is no in-app browser do not attempt to open the link at all. If you opened it, reply in one short sentence: "geenee is opening beside the conversation". If you have no in-app browser or opening failed, say nothing about it, nor about the button or the link: the Card already shows the user how to open geenee. If the user asked to load something, do it next; otherwise say nothing more. Do not repeat the Room id or a QR code in your reply.`,
      },
      { type: 'resource_link', uri: workspaceLink, name: 'Open geenee', description: 'The link that opens geenee', mimeType: 'text/html' },
    ],
    structuredContent,
  }
}
