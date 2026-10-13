/**
 * geenee's channel to the Workspaces of a Room: what it tells them, and what a
 * Room does with a report. The Room itself is a Durable Object (room.ts), which
 * supplies the sockets and the storage; nothing here needs the Worker runtime.
 */
import type { Viewer } from './servedTools.ts'

/** A Viewer as geenee and the Workspace name it to each other. */
export type ViewerKey = Viewer['prefix']

/**
 * What a Workspace is told: a tool call was for `viewer`, so bring it forward.
 * `count` numbers the reports of a Room, so that a Workspace told the same one
 * twice, as on joining again, can tell it has already acted on it.
 */
export interface ViewerUsed {
  type: 'viewerUsed'
  viewer: ViewerKey
  count: number
}

export interface WorkspaceSocket {
  send(message: string): void
}

/** What a Room is made of: the Workspaces in it, and the last report it keeps for one that joins later. */
export interface RoomHold {
  workspaces(): WorkspaceSocket[]
  lastUse(): Promise<ViewerUsed | undefined>
  keep(use: ViewerUsed): Promise<void>
}

/** Tells every Workspace in the Room that a tool call was for `viewer`, and keeps that for later ones. */
export async function reportUse(room: RoomHold, viewer: ViewerKey): Promise<void> {
  const use: ViewerUsed = { type: 'viewerUsed', viewer, count: ((await room.lastUse())?.count ?? 0) + 1 }
  await room.keep(use)
  for (const workspace of room.workspaces()) {
    try {
      workspace.send(JSON.stringify(use))
    } catch {
      /* this Workspace is leaving; the others are still told */
    }
  }
}

/** Tells a Workspace that has just joined which Viewer was last used, if any was. */
export async function welcome(room: RoomHold, workspace: WorkspaceSocket): Promise<void> {
  const use = await room.lastUse()
  if (use) workspace.send(JSON.stringify(use))
}
