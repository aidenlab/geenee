/**
 * open_geenee: geenee's own tool. It opens the Workspace, which holds both
 * Viewers (ADR 0002), and gives the model the one Room id every other tool
 * takes back. It stands in for each Upstream's own open tool, which geenee hides.
 */
import { PANE_RULE } from './instructions.ts'
import { mintRoomId } from './roomId.ts'
import { OPEN_GEENEE, type Viewer } from './servedTools.ts'
import type { Tool, ToolResult } from './upstream.ts'

export const OPEN_GEENEE_TOOL: Tool = {
  name: OPEN_GEENEE,
  title: 'Open geenee',
  description: `Get the geenee link, which opens one page beside the conversation holding the igv genome browser and the Juicebox contact-map viewer. Use this before any other geenee tool, and when the user asks to open geenee, IGV, a genome browser, Juicebox or a contact map, or greets any of them ("hello geenee", "hi igv", "hello juicebox"): call this tool straight away instead of only greeting back. One call opens both viewers; there is no separate tool to open either. When the user names igv or Juicebox ("start a new Juicebox session"), pass it as viewer, so that geenee opens with that viewer in front. Both connect once the link is open, and later tool calls redraw them. ${PANE_RULE} Do not repeat the link or the Room id in your reply. The result of this tool names the Room id: pass it as room on every later geenee tool call in this conversation.`,
  inputSchema: {
    type: 'object',
    properties: {
      room: {
        type: 'string',
        description:
          'Only when geenee was already opened in this conversation: the Room id from that reply of open_geenee, to get the same geenee back, with both viewers showing what they last showed. Leave it out the first time: geenee then opens in a new Room.',
      },
      viewer: {
        type: 'string',
        enum: ['igv', 'juicebox'],
        description:
          'Only when the user names a viewer: igv for the igv genome browser, juicebox for the Juicebox contact map viewer. geenee then opens with that viewer in front, and it counts as the viewer this conversation last used. Leave it out when the request names neither: the viewer in front stays as it was.',
      },
    },
  },
}

/** The link that opens the Workspace of a Room. `origin` is geenee's own address. */
function workspaceLinkFor(origin: string, room: string): string {
  const link = new URL('/', origin)
  link.searchParams.set('room', room)
  return link.toString()
}

/** What the result says of the Viewer the user named, so that the model treats it as the one last used. */
function inFront(viewer: Viewer | undefined): string {
  return viewer ? ` geenee opens with the ${viewer.name} viewer in front: it is the viewer this conversation last used.` : ''
}

/** Opens geenee in `room`, or in a new Room when none is given, with `viewer` in front when the user named one. */
export function openGeenee(origin: string, room: string = mintRoomId(), viewer?: Viewer): ToolResult {
  const link = workspaceLinkFor(origin, room)
  // A bare URL on its own line: Hosts render it clickable, which a code block
  // would not be. The resource link is the same link for Hosts that render
  // link content blocks.
  return {
    content: [
      {
        type: 'text',
        text: `geenee link:\n${link}\n\nRoom id: ${room}. Pass it as room on every later geenee tool call in this conversation, for igv and Juicebox tools alike.\n\nBoth viewers connect once this link is open, and later tool calls redraw them.${inFront(viewer)} ${PANE_RULE}\n\nIf the user already asked for something, go straight on to it with geenee tools. Otherwise reply in one short sentence (geenee is opening beside the conversation, or: here is the link to open geenee) and ask what to look at. Do not repeat the Room id in your reply.`,
      },
      { type: 'resource_link', uri: link, name: 'Open geenee', description: 'The link that opens geenee', mimeType: 'text/html' },
    ],
    structuredContent: { room, workspaceUrl: link },
  }
}
