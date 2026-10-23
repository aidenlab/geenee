/**
 * Cloudflare Worker entry point for geenee: the Connector at /mcp and what the
 * Workspace asks of it (see geenee.ts), with one Durable Object per Room for
 * the channel to its Workspaces (room.ts). The Workspace page is a static asset
 * of this Worker, built from index.html.
 */
import { createGeenee } from './geenee.ts'

export { Room } from './room.ts'

// One geenee for the life of the isolate: the Upstreams' addresses and the Rooms' namespace do not change between requests.
let geenee: ((request: Request) => Promise<Response>) | undefined

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    geenee ??= createGeenee({
      igvUpstream: env.IGV_UPSTREAM_URL,
      juiceboxUpstream: env.JUICEBOX_UPSTREAM_URL,
      // Each Upstream is a Worker on a custom domain, which a Worker of the same zone may fetch.
      fetch: (input, init) => fetch(input, init),
      roomRecord: (room) => {
        const stub = env.ROOM.get(env.ROOM.idFromName(room))
        return {
          start: (now) => stub.start(now),
          use: (now) => stub.use(now),
          expired: (now) => stub.expired(now),
          joinLinks: () => stub.joinLinks(),
          keepJoinLink: (viewer, link) => stub.keepJoinLink(viewer, link),
          viewerUsed: (viewer) => stub.viewerUsed(viewer),
          connect: (upgrade) => stub.fetch(upgrade),
        }
      },
      now: Date.now,
      workspacePage: (request) => env.ASSETS.fetch(new URL('/', request.url)),
    })
    return geenee(request)
  },
}
