/**
 * Stand-in Rooms: what the Room Durable Object is to geenee, held in memory,
 * with fake Workspaces that record what they are told.
 */
import type { RoomRecord } from '../src/geenee.ts'
import { hasExpired, start, use, type RoomClock } from '../src/roomLife.ts'
import { reportUse, welcome, type RoomHold, type ViewerKey, type ViewerUsed, type WorkspaceSocket } from '../src/workspaceChannel.ts'

export interface FakeWorkspace {
  /** What geenee has told this Workspace, oldest first. */
  told: ViewerUsed[]
}

export function standInRooms() {
  /** A Room as geenee keeps it, with `lastUsedAt` and `joinLinks` as plain fields for the stand-in to set. */
  type StandInRoom = RoomHold & RoomClock & { sockets: WorkspaceSocket[]; lastUsedAt?: number; joinLinks: Partial<Record<ViewerKey, string>> }
  const rooms = new Map<string, StandInRoom>()

  function hold(id: string) {
    let found = rooms.get(id)
    if (!found) {
      let last: ViewerUsed | undefined
      const sockets: WorkspaceSocket[] = []
      const room: StandInRoom = {
        sockets,
        joinLinks: {},
        usedAt: async () => room.lastUsedAt,
        keepUsedAt: async (at) => void (room.lastUsedAt = at),
        workspaces: () => sockets,
        lastUse: async () => last,
        keep: async (use) => void (last = use),
      }
      found = room
      rooms.set(id, found)
    }
    return found
  }

  return {
    /** open_geenee opened `room`, new, at `at`. */
    start(room: string, at: number): void {
      hold(room).lastUsedAt = at
    },
    /** True makes every report fail, as for a Room that cannot be reached. */
    unreachable: false,
    roomRecord(room: string): RoomRecord {
      const reached = () => {
        if (this.unreachable) throw new Error('the Room could not be reached')
        return hold(room)
      }
      return {
        start: async (now) => start(reached(), now),
        use: async (now) => use(reached(), now),
        expired: async (now) => hasExpired(reached(), now),
        joinLinks: async () => ({ ...reached().joinLinks }),
        keepJoinLink: async (viewer, link) => void (reached().joinLinks[viewer] = link),
        viewerUsed: async (viewer) => reportUse(reached(), viewer),
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
