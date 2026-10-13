/**
 * Cloudflare Worker entry point for geenee: the Connector at /mcp and what the
 * Workspace asks of it (see geenee.ts). The Workspace page is a static asset of
 * this Worker, built from index.html.
 */
import { createGeenee } from './geenee.ts'

// One geenee for the life of the isolate: the Upstreams' addresses do not change between requests.
let geenee: ((request: Request) => Promise<Response>) | undefined

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    geenee ??= createGeenee({
      igvUpstream: env.IGV_UPSTREAM_URL,
      juiceboxUpstream: env.JUICEBOX_UPSTREAM_URL,
      // Each Upstream is a Worker on a custom domain, which a Worker of the same zone may fetch.
      fetch: (input, init) => fetch(input, init),
    })
    return geenee(request)
  },
}
