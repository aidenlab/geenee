/**
 * How long a Room lives (ADR 0003): it expires after a day without use, and an
 * expired Room stays expired. geenee keeps its own clock for this, the time of
 * the Room's last use, rather than ask the Upstreams: each keeps a clock of its
 * own, and asking the igv one, through open_viewer, revives an expired Room. A
 * Room geenee has no time for was never opened by geenee, and is as good as
 * expired. The Room keeps the time (room.ts); nothing here needs the Worker
 * runtime.
 */

/** How long a Room lives without use. */
export const ROOM_LIFETIME_MS = 24 * 60 * 60 * 1000

/** A use is kept at most this often, so that a Workspace asking every few seconds does not write every few seconds. */
const USE_KEPT_EVERY_MS = 60 * 1000

/** Where a Room keeps the time of its last use, in milliseconds since the epoch. */
export interface RoomClock {
  usedAt(): Promise<number | undefined>
  keepUsedAt(at: number): Promise<void>
}

/** A new Room, opened at `now`. */
export async function start(room: RoomClock, now: number): Promise<void> {
  await room.keepUsedAt(now)
}

function alive(usedAt: number | undefined, now: number): usedAt is number {
  return usedAt !== undefined && now - usedAt < ROOM_LIFETIME_MS
}

/** Whether the Room has expired at `now`. Asking is not a use. */
export async function hasExpired(room: RoomClock, now: number): Promise<boolean> {
  return !alive(await room.usedAt(), now)
}

/** A use of the Room at `now`: false, and nothing kept, when it has expired. */
export async function use(room: RoomClock, now: number): Promise<boolean> {
  const usedAt = await room.usedAt()
  if (!alive(usedAt, now)) return false
  if (now - usedAt >= USE_KEPT_EVERY_MS) await room.keepUsedAt(now)
  return true
}
