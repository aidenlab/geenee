/**
 * The Workspace's one quiet "Get geenee" line, for a Guest: shown when the
 * Workspace was opened by a Room link, /r/<Room id>, and not by /?room=<Room
 * id>, the Organizer's link from the Card, since the Organizer already has
 * geenee. An Organizer who opens their own Room link sees it too.
 */
import { inRoomLinkPath, parseRoomId } from '../roomId.ts'

/** Whether a Workspace at `pathname` shows the line. */
export function offersGetGeenee(pathname: string): boolean {
  return parseRoomId(inRoomLinkPath(pathname) ?? '') !== null
}

