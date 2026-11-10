# Working on geenee

geenee is a proof of concept, and all four of its stages are done: it asks whether the igv, Juicebox and Spacewalk tool sets make sense behind one installation. The stages and what each settles are in the [spec](https://github.com/aidenlab/geenee/issues/1).

geenee contains none of the tool sets. It is a Cloudflare Worker that **forwards** to three Upstreams, the existing igv, Juicebox and Spacewalk MCP servers, and serves the Workspace page that frames their Viewers.

## Read first

- [`GLOSSARY.md`](GLOSSARY.md): the words used everywhere (Host, Connector, Upstream, Viewer, Workspace, Room, Card, Hand-off).
- [How geenee works](docs/how-geenee-works.html): the parts, the wires between them, and what happens on a tool call.
- [geenee's addresses](docs/geenee-addresses.html): every URL geenee serves, and every page a person meets.
- [geenee's Deployments](docs/deployments.html) and [How geenee deploys](docs/how-geenee-deploys.html): prod and dev, releasing, rolling back.
- [`docs/adr/`](docs/adr/): the decisions that shape geenee. [`docs/research/`](docs/research/merging-igv-and-juicebox-mcp-servers.md): the research behind them.

## Run it locally

Needs [Node.js](https://nodejs.org) and npm.

```sh
npm install
npm run dev   # the Worker and the Workspace together, on http://localhost:5173
```

The local Worker forwards to the **deployed dev Upstreams** and their Viewers; there is nothing else to run. A Host on this machine can use the local Connector directly, for example Claude Code:

```sh
claude mcp add --transport http geenee-local http://localhost:5173/mcp
```

Claude desktop and ChatGPT connect from their own servers, so they need a public `https://` address. Give the local Worker one with a tunnel, add the tunnel's host to `server.allowedHosts` in `vite.config.ts` while it is in use, and add `<tunnel address>/mcp` as a custom connector:

```sh
cloudflared tunnel --url http://localhost:5173
```

Or call the tools by hand. `open_geenee` replies with a Room id and the Workspace link; open the link and all three Viewers load. Every other tool takes the Room id back:

```sh
curl -s http://localhost:5173/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"open_geenee","arguments":{}}}'

curl -s http://localhost:5173/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"igv_go_to_gene","arguments":{"gene":"MYC","room":"<Room id>"}}}'
```

`npm run pages` opens every page a Guest meets, the Card included, at phone and computer size, light and dark. See [`docs/reviewing-pages.md`](docs/reviewing-pages.md).

## Test

```sh
npm run typecheck
npm run test:run                        # everything, once
npx vitest run test/routing.test.ts     # one file
```

The tests need no Worker runtime and no network. Stand-in Upstreams (`test/upstreams.ts`) serve the tool lists saved in `test/fixtures/`; to refresh one after an Upstream's tools change, save the `tools` array of its `tools/list` reply over the file. Stand-in Rooms (`test/workspaces.ts`) run the Room's own logic over fake sockets. The Room Durable Object (`src/room.ts`) and the Workspace page are checked by hand in a real Host.

## Deploy

```sh
npx wrangler login                    # first time on a machine
scripts/deploy-dev.sh my-branch       # try a branch, tag or commit on https://geenee-dev.3dg.io
git tag prod-2026-11-12 && git push origin prod-2026-11-12
scripts/deploy.sh prod-2026-11-12     # release https://geenee.3dg.io, the published Connector
```

Nothing deploys from CI. Each script deploys from a clean worktree, runs the type-check and tests, and checks the live Connector afterwards. The details, and what to do when something goes wrong, are in [How geenee deploys](docs/how-geenee-deploys.html).

## Scripts

| Command               | What it does                                                         |
| --------------------- | -------------------------------------------------------------------- |
| `npm run dev`         | The Worker and the Workspace with Vite, with hot module reload       |
| `npm run pages`       | The same, opening the page review                                    |
| `npm run build`       | Type-check, then build into `dist/`                                  |
| `npm run preview`     | Serve the built Worker and Workspace locally                         |
| `npm run typecheck`   | Write the Worker's types from `wrangler.toml`, then type-check       |
| `npm run test:run`    | Run every test once; `npm test` watches                              |
| `npm run deploy:prod` | Build and deploy prod with no checks; use `scripts/deploy.sh` instead |
| `npm run deploy:dev`  | Build and deploy dev with no checks; use `scripts/deploy-dev.sh` instead |

## Where things are

```
src/geenee.ts         The routes: /mcp, the Workspace's endpoints, Room links, the Hand-off, /install
src/servedTools.ts    The three Viewers and the tools geenee serves for each
src/room.ts           The Room Durable Object
src/workspace/        The Workspace page
wrangler.toml         The three Upstream addresses, for local, dev and prod: geenee's only configuration
```
