/**
 * Stand-in Rooms: what the Room Durable Object is to geenee, held in memory,
 * with fake Workspaces that record what they are told.
 */
import type { WorkspaceChannel } from '../src/geenee.ts'
import { reportUse, welcome, type RoomHold, type ViewerUsed, type WorkspaceSocket } from '../src/workspaceChannel.ts'

export interface FakeWorkspace {
  /** What geenee has told this Workspace, oldest first. */
  told: ViewerUsed[]
}

export function standInRooms() {
  const rooms = new Map<string, RoomHold & { sockets: WorkspaceSocket[] }>()

  function hold(room: string) {
    let found = rooms.get(room)
    if (!found) {
      let last: ViewerUsed | undefined
      const sockets: WorkspaceSocket[] = []
      found = {
        sockets,
        workspaces: () => sockets,
        lastUse: async () => last,
        keep: async (use) => void (last = use),
      }
      rooms.set(room, found)
    }
    return found
  }

  return {
    /** True makes every report fail, as for a Room that cannot be reached. */
    unreachable: false,
    channelTo(room: string): WorkspaceChannel {
      return {
        viewerUsed: async (viewer) => {
          if (this.unreachable) throw new Error('the Room could not be reached')
          await reportUse(hold(room), viewer)
        },
        connect: async () => {
          throw new Error('stand-in Rooms take no WebSocket: use openWorkspace')
        },
      }
    },
    /** A Workspace joins `room`, as one does when its page opens. */
    async openWorkspace(room: string): Promise<FakeWorkspace> {
      const workspace: FakeWorkspace = { told: [] }
      const socket = { send: (message: string) => void workspace.told.push(JSON.parse(message)) }
      const joined = hold(room)
      joined.sockets.push(socket)
      await welcome(joined, socket)
      return workspace
    },
  }
}
