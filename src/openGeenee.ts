/**
 * open_geenee: geenee's own tool. It opens the Workspace, which holds all
 * three Viewers (ADR 0002), and gives the model the one Room id every other tool
 * takes back. It stands in for each Upstream's own open tool, which geenee hides.
 */
import { cardContent, roomLinkLines, TOOL_META, whatToShow } from './card.ts'
import { OPEN_GEENEE } from './servedTools.ts'
import type { Tool, ToolResult } from './upstream.ts'

export const OPEN_GEENEE_TOOL: Tool = {
  name: OPEN_GEENEE,
  // Hosts head the Card with this title, as "Opened Get geenee link".
  title: 'Get geenee link',
  description:
    'Call this first in a conversation, before any other geenee tool, so the user is shown geenee\'s Card before any viewer acts; and first again whenever a geenee tool replies that the Room has expired. Call it even when the user only greets geenee or one of its viewers ("hello geenee", "launch geenee", "hi igv", "hello juicebox", "hello spacewalk"), straight away instead of only greeting back, and when the user asks to open geenee, IGV, a genome browser, Juicebox, a contact map, Spacewalk or 3D chromatin. It gets the link that opens geenee: one page beside the conversation holding the igv genome browser, the Juicebox contact-map viewer and the Spacewalk 3D chromatin viewer. One call opens all three viewers; there is no separate tool to open any one of them. If you have a browser that shows pages inside this app, beside the conversation, open the link in it right away: all three viewers connect there and later tool calls redraw them. Use only such an in-app browser; a tool that drives the user\'s own web browser is not one, and if there is no in-app browser do not try anything else. Where this app draws geenee\'s Card, the user is shown it, with an Open geenee button, for when the link is not opened beside the conversation; the result says what to show where there is no Card. The result of this tool names the Room id: pass it as room on every later geenee tool call in this conversation.',
  inputSchema: {
    type: 'object',
    properties: {
      room: {
        type: 'string',
        description:
          'Only to get geenee back beside the conversation, with all three viewers showing what they last showed, once it was opened in this conversation: the Room id from that reply of open_geenee. Leave it out the first time: geenee then opens in a new Room.',
      },
    },
  },
  _meta: TOOL_META,
}

/** Opens geenee in `room`, a Room that has not expired. */
export function openGeenee(origin: string, room: string): ToolResult {
  const card = cardContent(origin, room)
  const { workspaceLink, qrImage, structuredContent } = card
  // A bare URL on its own line: Hosts render it clickable, which a code block
  // would not be. The resource link is the same link for Hosts that render
  // link content blocks, and the image the QR code for Hosts that show images.
  return {
    content: [
      {
        type: 'text',
        text: `geenee link:\n${workspaceLink}\n\n${roomLinkLines(card)}Room id: ${room}. Pass it as room on every later geenee tool call in this conversation, for igv, Juicebox and Spacewalk tools alike.\n\nNext step: if you have a browser that shows pages inside this app, beside the conversation, open the geenee link in it now so geenee shows there. Never use a tool that drives the user's own web browser, and if there is no in-app browser do not attempt to open the link at all. If you opened it, reply in one short sentence: "geenee is opening beside the conversation". If you have no in-app browser or opening failed, say nothing about it, nor about the button: the Card, or where there is none the Room link, shows the user how to open geenee. If the user asked to load something, do it next.\n\n${whatToShow(card)}`,
      },
      { type: 'resource_link', uri: workspaceLink, name: 'Open geenee', description: 'The link that opens geenee', mimeType: 'text/html' },
      ...(qrImage ? [qrImage] : []),
    ],
    structuredContent,
  }
}
