# geenee

One Connector for Claude and ChatGPT that lets the model drive both the [igv.js](https://github.com/igvteam/igv.js) genome browser and the [Juicebox](https://github.com/aidenlab/juicebox.js) contact-map viewer from a single conversation, shown together beside it.

**This is a proof of concept, and all four of its stages are done.** It asks whether the two existing tool sets make sense behind one installation. It has been checked by hand in Claude desktop and in ChatGPT, in Codex and in Chat, and works in both. The stages and what each one settles are in the [spec](https://github.com/aidenlab/geenee/issues/1).

The vocabulary used here (Host, Connector, Upstream, Viewer, Workspace, Room) is defined in [`GLOSSARY.md`](GLOSSARY.md). The two decisions that shape geenee are in [`docs/adr/`](docs/adr/), and the research behind them is in [`docs/research/`](docs/research/merging-igv-and-juicebox-mcp-servers.md).

## How it works

- geenee contains neither tool set. It **forwards** to two **Upstreams**, the deployed dev servers of [`igvjs-mcp`](https://github.com/aidenlab/igvjs-mcp) and `juicebox-mcp`, and neither of them is changed (ADR 0001). Each stays a working Connector in its own right.
- `juicebox-mcp` has two dev stacks, one for each Juicebox page: **web**, the juicebox-web page that Juicebox is moving away from, and **view**, the juicebox-view page it is moving to. Their Upstreams serve the same tools and differ only in the page their Join link opens. geenee has one deployment for each stack (see [Deploying](#deploying)), and local development uses the view stack.
- The **server** is a Cloudflare Worker with an MCP endpoint (`/mcp`, stateless Streamable HTTP) for the Host. It also serves the Workspace page. The Connector keeps no state between requests; the one thing geenee keeps is in a Durable Object per Room, which holds the sockets of the Room's Workspaces and the Viewer last used.
- The **tool list** is the two Upstreams' lists put together, asked for afresh on each request, so a change to an Upstream's tools appears without a geenee release. Every tool is served under a name prefixed with its Viewer: `igv_zoom_in`, `juicebox_zoom_in`. A name that already says which Viewer it belongs to is left alone (`juicebox_help`).
- An Upstream's descriptions and replies name its tools by their own names ("call read_session_summary first"). geenee **rewrites those names** to the ones it serves, in tool descriptions, argument descriptions and reply text.
- Three Upstream tools are **hidden**: `open_viewer` (igv), and `get_juicebox_url` and `join_room` (Juicebox). A Viewer is only ever opened inside the Workspace. Text that names a hidden tool is rewritten to name `open_geenee`. With geenee's own tool that makes 44: `open_geenee`, 13 for igv and 30 for Juicebox.
- `open_geenee` mints one **Room** id and returns the link that opens the Workspace in that Room. Every other tool takes the Room id back as a required `room` argument, including Juicebox tools whose Upstream versions take none; a call without it is refused with advice to call `open_geenee`. Called with `room`, `open_geenee` gives the link to that Room again.
- One Room id names a Room in each Upstream. The igv Upstream is given it as the tool's `room` argument. The Juicebox Upstream acts on the Room of the call's MCP session, and a session it has bound to no Room has the Room whose id is the session id, so geenee sends the Room id as the `mcp-session-id` header. This was read from the Juicebox Upstream's code and has since been seen to reach the right Viewer in a Host.
- The **server instructions** tell the model what each Viewer is for, and how to treat a request that fits both ("zoom in", "go to MYC"): use the Viewer the conversation last used, and ask only when neither has been used. The server cannot see the conversation, so choosing a Viewer is the model's work.
- When one Upstream **cannot be reached**, the other's tools are still listed and forwarded. A call to a tool of the missing one gets an error reply that says so. A call an Upstream refuses, such as one with arguments it does not accept, is passed back in the Upstream's words.
- The **Workspace** is the one geenee page a person opens beside the conversation (ADR 0002). It frames the igv Viewer and the Juicebox Viewer, loads both when it opens, and shows one at a time. Each Viewer is still served from its own address and talks to its own Upstream as before.
- The Workspace learns each Viewer's address by asking the Worker (`GET /viewers?room=`), which calls each Upstream's own open tool for that Room and passes on the Join link in its reply. So the two Upstream addresses are geenee's only configuration.
- The Workspace **brings forward the Viewer a tool was last called for**. Each tool call the Connector forwards is reported to the Room's Durable Object, alongside the call, and the Room tells every Workspace joined to it over a WebSocket (`/ws?room=`). Any forwarded tool counts, a search included; `open_geenee` and a call that is refused do not. A person can click the other tab, and it stays picked until the next tool call. The Room keeps the last report, and nothing else, for a Workspace that opens later.
- Each tab carries a **mark**, filled when its Viewer is connected and hollow when it is not. The Workspace asks the Worker every few seconds (`GET /connections?room=`), which asks each Upstream with a tool that changes nothing in the Viewer: `read_session_summary` for igv, which answers with an error when no Viewer is in the Room, and `get_server_status` for Juicebox, which says `Browser Connected: Yes` or `No`. Neither Upstream has more of a contract for this than those replies. A Viewer whose Upstream cannot be reached shows as not connected.

ChatGPT needs nothing of its own: it opens the Workspace from the same `open_geenee` result as Claude, so the separate card with an "Open geenee" button planned for stage 4 was not built.

## Requirements

- [Node.js](https://nodejs.org) and npm

## Getting started

```sh
npm install
npm run dev   # the Worker and the Workspace together, on http://localhost:5173
```

Local development is the local Worker and Workspace against the **deployed dev Upstreams** and their Viewers: geenee has no Viewer of its own to run beside it. There is no stdio entry point. The Juicebox Upstream is the view stack's. To run against the web stack's instead, build the `dev` environment of `wrangler.toml`:

```sh
CLOUDFLARE_ENV=dev npm run dev
```

An MCP client running on this machine can use `http://localhost:5173/mcp` directly, for example Claude Code:

```sh
claude mcp add --transport http geenee-dev http://localhost:5173/mcp
```

A custom connector in Claude desktop or ChatGPT cannot: those Hosts connect from their own servers and need a public `https://` URL. To try a local geenee in those Hosts, give it one with a tunnel and use the address it prints, with `/mcp` appended, as the connector URL:

```sh
cloudflared tunnel --url http://localhost:5173
```

The Workspace link is built from the address the request came to, so through a tunnel it carries the tunnel's address. Vite refuses requests for a host it does not know, so the tunnel's host has to be added to `server.allowedHosts` in `vite.config.ts` for as long as the tunnel is in use.

Or call the tools by hand:

```sh
# open_geenee: replies with the Room id and the Workspace link, http://localhost:5173/?room=<Room id>
curl -s http://localhost:5173/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"open_geenee","arguments":{}}}'
```

Open the Workspace link in a browser: both Viewers load, each in its own Room of that id, and the mark on each tab fills once its Viewer has connected.

With the Workspace open, a tool of either Viewer changes that Viewer and brings it forward:

```sh
curl -s http://localhost:5173/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"igv_go_to_gene","arguments":{"gene":"MYC","room":"<Room id>"}}}'

curl -s http://localhost:5173/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"juicebox_list_panels","arguments":{"room":"<Room id>"}}}'
```

## Tests

```sh
npm run typecheck
npm run test:run   # the Connector, through its fetch handler, with stand-in Upstreams
```

The tests need no Worker runtime and no network. The stand-in Upstreams (`test/upstreams.ts`) list the tools saved in `test/fixtures/`, which are copies of the two Upstreams' real tool lists, and record the calls they are sent. They cover the combined tool list and its renaming, where a call is sent and what is passed back, `open_geenee`, the server instructions, an Upstream that cannot be reached, `/viewers`, which Viewer a tool call is reported for and that the report reaches the Workspaces of its Room, and `/connections`.

The Rooms in the tests are stand-ins too (`test/workspaces.ts`): they run the Room's own logic (`src/workspaceChannel.ts`) over fake sockets. The Durable Object that wraps it (`src/room.ts`) and the Workspace page have no automated tests. They are checked by hand in a real Host, with the rest of each stage.

## Deploying

There are two deployments, both for development, one for each Juicebox dev stack of `juicebox-mcp`. Deploying one never affects the other: each is its own Worker with its own Rooms. Nothing deploys from CI.

| Stack | Part                 | Cloudflare name    | Address                           | Juicebox Upstream                     | Juicebox Viewer page                    |
| ----- | -------------------- | ------------------ | --------------------------------- | ------------------------------------- | --------------------------------------- |
| web   | Worker and Workspace | `geenee-dev`       | `https://geenee-dev.3dg.io`       | `https://juicebot-mcp-dev.3dg.io`      | `https://juicebot-dev.3dg.io/`           |
| view  | Worker and Workspace | `geenee-view-dev`  | `https://geenee-view-dev.3dg.io`  | `https://juicebot-view-mcp-dev.3dg.io` | `https://juicebot-view-dev.pages.dev/`   |

Each Worker serves `/mcp` for Hosts and `/` for the Workspace. Both use the igv Upstream `https://igv-bot-mcp-dev.3dg.io`.

```sh
npx wrangler login                    # first time on a machine
scripts/deploy-test.sh view           # or web; deploys HEAD
scripts/deploy-test.sh view <ref>     # a branch, tag or commit instead
```

The script checks out the ref into a throwaway worktree, so uncommitted changes never ship. There it installs, type-checks, runs the tests, builds and deploys. It then checks that the deployed Connector is this build, counts the tools it lists and checks that its Workspace frames that stack's Juicebox page.

Each deploy is stamped with a build number: the commit count, short hash and build time, e.g. `18 (793af76, 2026-10-20 14:58 EDT)`. The count and hash say which code it is, the time which deploy (`-dirty` follows the hash when `npm run deploy:*` builds a working copy with uncommitted changes; `scripts/build-number.sh`). The Connector gives it as its version, the Workspace shows it with the Connector URL at the right end of its tab bar, and the script prints both when it finishes. `npm run dev` shows none.

geenee only forwards, so the script deploys geenee alone. The Juicebox stack it forwards to is deployed from `juicebox-mcp`, with its own `scripts/deploy-test.sh <web|view> <page-repo>`, and has to be up for the final check to pass.

It needs a Cloudflare login that can reach the account that owns the `3dg.io` zone, which is named in `wrangler.toml` and also holds both Upstreams. The first deploy of each creates the DNS record for its custom domain. There is no sign-in and there are no secrets, as for the Upstreams.

The connector URL to give Claude or ChatGPT is `https://geenee-view-dev.3dg.io/mcp` for the view stack, or `https://geenee-dev.3dg.io/mcp` for the web stack. In Claude: Settings, Connectors, Add custom connector, with the OAuth fields left blank. Both can be added side by side, for example as "geenee dev (view)" and "geenee dev (web)".

## Scripts

Run from the repository root.

| Command              | What it does                                                              |
| -------------------- | ------------------------------------------------------------------------- |
| `npm run dev`        | Start the Worker and the Workspace with Vite, with hot module reload      |
| `npm run build`      | Type-check, then build the Worker and the Workspace into `dist/`          |
| `npm run preview`    | Serve the built Worker and Workspace locally                              |
| `npm run types`      | Write `worker-configuration.d.ts`, the Worker's `Env` and runtime types, from `wrangler.toml` |
| `npm run typecheck`  | Write the types, then type-check the Worker and the tests, and the Workspace apart from them |
| `npm run test:run`   | Run every test once                                                       |
| `npm test`           | Run the tests in watch mode                                               |
| `npm run deploy:dev` | Build the `dev` environment (web stack) and deploy it, with no checks; `scripts/deploy-test.sh web` runs them first |
| `npm run deploy:view-dev` | Build the `view-dev` environment (view stack) and deploy it, with no checks; `scripts/deploy-test.sh view` runs them first |

Run a single test file by adding its path: `npx vitest run test/routing.test.ts`.

## Project layout

One package: a Worker and the page it serves, built together by Vite through Cloudflare's Vite plugin.

```
wrangler.toml            Worker configuration: the two Upstream addresses, the Room Durable Object, the two dev deployments
tsconfig.json            Type-checking of the Worker and the tests; src/workspace has its own, with the DOM
vite.config.ts           The build of the Worker and the Workspace
vitest.config.ts         The tests, kept apart from the Cloudflare plugin
index.html               The Workspace page: the two tabs, each with its mark, and the two panels
src/
  index.ts               Worker entry point
  geenee.ts              Routes /mcp, /viewers, /connections and /ws; lists the tools, forwards a call and reports it, answers for an Upstream that cannot be reached
  servedTools.ts         The two Viewers, and the tools geenee serves for each: names, hidden tools, the room argument, rewriting, how each says it is connected
  upstream.ts            One Upstream as geenee reaches it: JSON-RPC over POST to its /mcp
  openGeenee.ts          The open_geenee tool
  instructions.ts        The server instructions
  roomId.ts              Minting and recognising Room ids
  workspaceChannel.ts    What a Workspace is told, and what a Room does with a report
  room.ts                The Room Durable Object: the sockets of a Room's Workspaces
  workspace/main.ts      The Workspace: frames the Viewers, the tabs and their marks, follows the channel
  workspace/workspace.css
test/
  fixtures/              Saved copies of the two Upstreams' tool lists
  upstreams.ts           The stand-in Upstreams
  workspaces.ts          The stand-in Rooms and their fake Workspaces
  connector.ts           The Host's side of the Connector, for the tests
  *.test.ts              Tests
scripts/
  deploy-test.sh         Deploy geenee-dev (web) or geenee-view-dev (view)
docs/
  adr/                   The decisions: forwarding, and the Workspace
  research/              The research on merging the two servers
  agents/                How agents use the issue tracker, the labels and these docs
```

### Configuration

- `wrangler.toml`, `IGV_UPSTREAM_URL`: the `/mcp` address of the igv Upstream.
- `wrangler.toml`, `JUICEBOX_UPSTREAM_URL`: the `/mcp` address of the Juicebox Upstream.

The top-level values are for local development, the `[env.dev]` values for the web deployment and the `[env.view-dev]` values for the view deployment. All of them name deployed dev Upstreams. They differ only in the Juicebox Upstream, which is the view stack's at the top level. The Viewers' own addresses are not configured: each Upstream gives its Viewer's.

To refresh a fixture after an Upstream's tools change, save the `tools` array of its `tools/list` reply over the file in `test/fixtures/`.
