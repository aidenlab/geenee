/**
 * share_geenee: geenee's own tool for showing the Card of a Room again, for
 * Guests who arrive after the first Card has scrolled out of sight. It never
 * opens a Room: the Guests already in it keep their link.
 */
import { cardContent, TOOL_META } from './card.ts'
import { OPEN_GEENEE, SHARE_GEENEE } from './servedTools.ts'
import type { Tool, ToolResult } from './upstream.ts'

export const SHARE_GEENEE_TOOL: Tool = {
  name: SHARE_GEENEE,
  title: 'Share geenee',
  description: `Shows the user geenee's Card again, with its Room link and QR code, so that others can join the same Room. Call it when the user asks to "show the QR code again", to "share geenee", "how do others join" or says "someone just arrived". It opens no new Room: the people already in the Room keep their link. Do not repeat the link, the Room id or a QR code in your reply.`,
  inputSchema: {
    type: 'object',
    properties: {
      room: {
        type: 'string',
        description: `The Room id from the reply of ${OPEN_GEENEE} in this conversation.`,
      },
    },
    required: ['room'],
  },
  _meta: TOOL_META,
}

/** Shows the Card of `room`, a Room that has not expired, again: the same Room link and QR code as before. */
export function shareGeenee(origin: string, room: string): ToolResult {
  const { roomLink, structuredContent } = cardContent(origin, room)
  return {
    content: [
      {
        type: 'text',
        text: `The Card is shown again, with the Room link and its QR code:\n${roomLink}\n\nOthers who scan the code or open the link join this same Room, ${room}; nothing changed for those already in it. Reply in one short sentence that they can scan the code to join. Do not repeat the link, the Room id or a QR code in your reply.`,
      },
      { type: 'resource_link', uri: roomLink, name: 'Room link', description: 'The link that brings others into this Room', mimeType: 'text/html' },
    ],
    structuredContent,
  }
}
