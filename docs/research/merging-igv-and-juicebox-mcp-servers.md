# Merging the igv.js and juicebox.js MCP servers into geenee: research notes

Research pass of 2026-10-13. No design decisions are made here. Section 7 is labelled judgement; everything else is meant to be findings.

## How to read the citations

- `igv:` means the `igvjs-mcp` repository (branch `main`, HEAD `830cc9a`, remote `aidenlab/igvjs-mcp`).
- `jb:` means the `juicebox-mcp` repository (branch `main`, HEAD `209eb05`, remote `weiszd/juicebox-mcp`, a fork; its `package.json` names `aidenlab/juicebox-mcp`, `jb:package.json:16-19`).
- `path:line` is a line in the working tree as read on that date.
- Web sources are cited by URL. Two revisions of the MCP specification were read: **2026-07-28**, which https://modelcontextprotocol.io/specification/versioning names as the current one, and **2025-11-25**, the last revision with the `initialize` handshake, which is what both servers speak today (section 1.1).
- **Read** means I read it in the source named. **Inferred** means I concluded it from what I read. **Unverified** means I could not check it. Nothing was run against a live Host; all statements about what Claude or ChatGPT do come from first-party documentation or from the two repos' own recorded observations.
- A caveat on the OpenAI pages: the fetch tool returned a summary of each OpenAI page, not its full text. The quoted phrases are the ones the tool returned as quotes. The MCP specification pages and the Claude documentation pages came back as full text.

## 1. Summary of key findings

1. **The two servers are the same architecture, and one was copied from the other.** igvjs-mcp says so: "`juicebox-mcp` is the model for the whole mechanism: Room, Join link, join card, command and ack protocol, binding a Room to an MCP session (including the ChatGPT path), and Catalogue search" (`igv:docs/v1-design.md:21`). Both are a Cloudflare Worker with a stateless Streamable HTTP endpoint at `POST /mcp` and a WebSocket endpoint at `/ws` backed by one Durable Object per room. Neither renders anything itself: a tool call becomes a command pushed over the WebSocket to an ordinary web page that hosts the viewer, and the page's ack becomes the tool result.
2. **They share no code.** The lineage is copy and rewrite: igvjs-mcp is TypeScript with zod 4, juicebox-mcp is plain JavaScript with zod 3, and the wire protocols between server and page have the same shape but different field names (section 3).
3. **They have diverged on the one thing that matters most for a merge: how a tool call finds its room.** juicebox-mcp binds the room to the MCP session id, with a `join_room` tool to rebind. igvjs-mcp found that this breaks in Claude desktop, where one conversation spans two MCP sessions, and now has the model carry a `room` argument on every call (`igv:docs/adr/0003-the-model-carries-the-room-id.md:3-5`). The 2026-07-28 MCP specification removes protocol sessions altogether and recommends exactly the igvjs-mcp pattern (section 4.2).
4. **Three tool names collide exactly** (`zoom_in`, `zoom_out`, `remove_track`) with different input schemas, and about seven more pairs are near-duplicates in purpose (`go_to_locus` and `goto_locus`, `load_tracks` and `load_track`, and so on). The combined set is 46 tools (14 + 32) and about 42,000 characters of tool definitions.
5. **Neither server uses any of the MCP features that help a model route between tool sets.** On `main`, neither sets server `instructions`, neither sets tool `annotations`, and neither declares prompts. juicebox-mcp has an unmerged branch that adds `instructions` (section 2.2).
6. **"Expose a tool set depending on context" has no direct protocol mechanism.** The server never sees the conversation. In the current specification `tools/list` "MUST NOT vary per-connection or as a side effect of other requests on the connection". What exists is: static tool names and descriptions that the model routes on, server `instructions`, client-side deferral (documented for Claude Code and the Claude API, not for claude.ai chat), and `list_changed`, which ChatGPT's documentation does not mention and which neither server can send today (section 4).
7. **Tool descriptions and replies refer to other tools by name** ("call open_viewer", "Use get_juicebox_url"). Any option that prefixes or renames tools, including an unchanged-servers proxy, must rewrite that text or leave those names alone (section 3.3).
8. **juicebox.js already contains igv.js.** juicebox.js 4.10.0-mcp.1 depends on `igv` 3.8.9, the same version the igv-bot Viewer uses, and juicebox's `load_track` loads igv-format track files. The two catalogue searches read the same `igvteam/igv-data` repository and are complementary: igv-bot's search deliberately excludes Hi-C contact maps, juicebox's searches are for them (section 3.4).

## 2. The two existing servers

### 2.1 igvjs-mcp ("igv-bot")

#### Stack

| Item | Value | Source |
| --- | --- | --- |
| Language | TypeScript `~6.0.2`, ESM | `igv:package.json:5,21` |
| Layout | npm workspaces: `server`, `viewer`, `roundtrip` | `igv:package.json:6-10` |
| Runtime | Cloudflare Worker, `compatibility_date = "2026-08-01"`, `nodejs_compat` | `igv:server/wrangler.toml:4-6` |
| MCP SDK | `@modelcontextprotocol/sdk` `^1.32.1`; 1.32.1 installed | `igv:server/package.json:14`; `node_modules/@modelcontextprotocol/sdk/package.json` |
| Schema library | zod `^4.4.3` | `igv:server/package.json:16` |
| Viewer | Vite `^8.3.0`, Sass, `igv` `^3.8.9` (3.8.9 installed) | `igv:viewer/package.json:17,20-21` |
| Tooling | wrangler `^4.149.0`, vitest `^4.1.0`, `@cloudflare/vitest-pool-workers`, Playwright for the round trip | `igv:server/package.json:19-20`, `igv:package.json:22`, `igv:roundtrip/package.json:15` |
| Protocol revisions the SDK speaks | `2025-11-25` (latest), `2025-06-18`, `2025-03-26`, `2024-11-05`, `2024-10-07` | `node_modules/@modelcontextprotocol/sdk/dist/esm/types.js:2-4` |

#### Transport, hosting, installation, auth

- **Transport**: Streamable HTTP only, stateless, JSON responses. `POST /mcp` is served; `GET /mcp` returns 405, so there is no server-to-client stream; there is no stdio entry point (`igv:server/src/index.ts:53-62`, `igv:README.md:40`). Every request builds a fresh `McpServer` and a `WebStandardStreamableHTTPServerTransport` with `sessionIdGenerator: undefined` and `enableJsonResponse: true` (`igv:server/src/index.ts:114-129`).
- **Hosting**: one deployed stack, for development. Worker `igv-bot-mcp-dev` at `igv-bot-mcp-dev.3dg.io`; Viewer as Cloudflare Pages project `igv-bot-web-dev` (`igv:server/wrangler.toml:47-70`, `igv:scripts/deploy-dev.sh:4-5`). Nothing deploys from CI and the repo has no `.github` directory (`igv:README.md:94`).
- **Auth**: none. "No authentication is asked for" (`igv:docs/v1-design.md:131`). The WebSocket endpoint checks `Origin` against `VIEWER_ORIGINS` (`igv:server/src/index.ts:43-47`). The Room id is the only capability (`igv:docs/adr/0003-the-model-carries-the-room-id.md:23`).
- **Install in Claude**: Settings, Connectors, Add custom connector, with the `/mcp` URL and OAuth fields blank (`igv:docs/release-checklist.md:14`). Claude Code: `claude mcp add --transport http igv-bot-dev http://localhost:8787/mcp` (`igv:README.md:45`).
- **Install in ChatGPT**: "In Codex mode: Settings → Plugins → Add → Add MCP server, with Name `igv-bot`, Type Streamable HTTP" (`igv:docs/release-checklist.md:15`).
- **Hosts claimed**: "Claude desktop, claude.ai on the web, and ChatGPT desktop in Codex mode. A plain ChatGPT chat and ChatGPT on the web are not supported" (`igv:README.md:5`). This is a recorded observation of 2026-10-12 (`igv:docs/v1-design.md:129-131`), not something code can confirm. Unverified by me.

#### Tools, resources, prompts

14 tools, pinned by a fixture that a test compares against `tools/list` (`igv:server/test/fixtures/tools.json`, `igv:server/test/mcp.test.ts:218-223`). Every tool has a `title`. No tool has `annotations`. No server `instructions`. No prompts. (A grep of `igv:server/src` for `annotations`, `readOnlyHint`, `instructions`, `registerPrompt` finds nothing.)

Every tool also takes an optional string `room`: "The Room id igv-bot was opened with, as given in the reply of open_viewer. Pass it on every call." (`igv:server/src/tools.ts:41-44`, added at `:205`).

| Tool | Title | Inputs besides `room` | Reaches the Viewer? | Source |
| --- | --- | --- | --- | --- |
| `open_viewer` | Open igv-bot | `genome?`, `locus?` (new Room only) | No. Mints a Room and returns the Join link. Carries the Join card `_meta` | `igv:server/src/tools.ts:138-199` |
| `go_to_locus` | Go to a locus | `locus` string | Yes | `igv:server/src/commandTools.ts:26-33` |
| `go_to_gene` | Go to a gene | `gene` string | Yes | `:35-42` |
| `zoom_in` | Zoom in | none | Yes | `:44-49` |
| `zoom_out` | Zoom out | none | Yes | `:51-56` |
| `change_genome` | Change genome | `genome` string, checked against the igv.org list first | Yes | `:58-66` |
| `load_tracks` | Load tracks | `tracks`: array of `{url, name?}`, at least one | Yes | `:68-83` |
| `remove_track` | Remove a track | `name?` or `position?` (number, 1 at the top) | Yes | `:85-94` |
| `set_track_height` | Set track height | `height` (number, `"taller"`, `"shorter"`), `names?`, `positions?`, `all?` | Yes | `:96-110` |
| `set_crosshairs` | Show or hide the crosshairs | `show` boolean | Yes | `:112-119` |
| `set_centre_line` | Show or hide the centre line | `show` boolean | Yes | `:121-128` |
| `read_session_summary` | Read the Session summary | none | Yes (changes nothing) | `:130-136` |
| `get_shareable_url` | Get the Shareable URL | none | Yes (the Viewer builds the link) | `:138-143` |
| `search_catalogues` | Search the ENCODE and 4DN Catalogues | `text?`, `biosample?`, `assay?`, `target?`, `outputType?`, `genome?` | No. Answered by the server; reads only the Room's last Session summary for the genome | `igv:server/src/tools.ts:248-311` |

One resource: `ui://igv-bot/join`, MIME type `text/html;profile=mcp-app`, the Join card (`igv:server/src/tools.ts:128-133`, `igv:server/src/joinCard.ts:14-15`).

#### How a tool call reaches igv.js, end to end

1. The Host posts `tools/call` to `/mcp`. The Worker reads `mcp-session-id` and `x-openai-session` from the headers (`igv:server/src/index.ts:90-91`).
2. `open_viewer` without `room` mints a new 10-character Crockford base32 Room id and returns a Join link, the Viewer's URL with `?room=` (`igv:server/src/tools.ts:160`, `:118-122`, `igv:server/src/roomId.ts:12-14`). If `genome` or `locus` was given it first saves `{genome, locus}` in the new Room for the Viewer to restore (`igv:server/src/tools.ts:162-167`).
3. The reply holds the link as text, as a `resource_link`, and as `structuredContent {room, joinUrl}` for the Join card (`igv:server/src/tools.ts:184-197`). The tool description and the reply text tell the model to open the link in the Claude desktop app's built-in browser and never in Claude in Chrome (`igv:server/src/tools.ts:143`, `:192`).
4. The Join card is an MCP App: an HTML document served as a resource, which loads `@modelcontextprotocol/ext-apps@1.7.5` from unpkg and offers one button that calls `app.openLink({url: joinUrl})` (`igv:server/src/joinCard.ts:18`, `:66`). It never holds the genome browser: "the Host's sandbox forbids framing other origins" (`igv:server/src/joinCard.ts:6-7`).
5. The Viewer page loads, reads `?room=`, and opens a WebSocket to `/ws?room=` (`igv:viewer/src/main.ts:95-104`). The Worker checks the `Origin`, checks the id's shape, and hands the socket to the Room's Durable Object (`igv:server/src/index.ts:42-51`). The Viewer sends `join`; the Room answers `joined` with any saved Session (`igv:server/src/room.ts:151-154`). igv.js is created only then (`igv:viewer/src/main.ts:99-100`).
6. A command tool resolves its Room (the `room` argument, else the MCP session's Room), then calls the Durable Object's `command()` over RPC (`igv:server/src/tools.ts:207`, `:217`; `igv:server/src/index.ts:118`).
7. The Room sends `{type: "command", id, command}` to every socket and waits up to 15 seconds for the first `ack` (`igv:server/src/room.ts:14`, `:50-75`).
8. The Viewer applies the command to igv.js and acks with `ok` or igv.js's own error, always with the resulting Session summary (`igv:viewer/src/main.ts:107-112`, `igv:viewer/src/protocol.ts:103`).
9. The tool result is "Done." or the error, followed by the Session summary as JSON (`igv:server/src/tools.ts:234-240`). No Viewer in the Room is an error result; no ack in time is "Sent, unconfirmed" (`:220-233`).

There is no headless rendering and no image is ever returned.

#### State and session model

- **The Session lives in the Viewer.** After every change, by a command or by hand, the Viewer sends the Room its igv.js Session and a Session summary; the Room stores both in Durable Object storage as mirrors (`igv:server/src/room.ts:155-159`, `igv:docs/adr/0002-server-pushes-commands-through-a-room.md:17`).
- **A Room is not tied to an MCP session.** `open_viewer` without `room` always mints a new Room, so each conversation gets its own; the server "keeps no record of which MCP session goes with which Room" (`igv:docs/adr/0003-the-model-carries-the-room-id.md:5-7`).
- **The MCP-session-to-Room binding is still in the code but leads nowhere.** `initialize` still returns a minted Room id as `mcp-session-id`, and `x-openai-session` is still HMAC-derived into a Room id (`igv:server/src/index.ts:97-113`, `:133-136`). The ADR says this "no longer leads to a Viewer. It is kept for now and can be retired" (`igv:docs/adr/0003-the-model-carries-the-room-id.md:21`).
- **Several Viewers may join one Room**; all get commands, the first ack wins, and they are not kept in step with each other's hand changes (`igv:docs/adr/0002-server-pushes-commands-through-a-room.md:21`).
- **Expiry**: stored data is deleted 24 hours after the last Viewer message unless a Viewer is connected; a later join is told `expired`; `open_viewer` with that `room` renews it (`igv:server/src/room.ts:29`, `:91-93`, `:110-117`, `:137-141`).

#### Tests and docs

- About 103 server tests, 52 Viewer tests and 48 round-trip tests (counts of `it(` per file; approximate). The round trip drives the built Viewer in headless Chromium against the local Worker and is not hermetic (`igv:README.md:86-90`).
- A per-Host manual release checklist exists (`igv:docs/release-checklist.md`).

#### README claims checked against the code

| Claim | Verdict |
| --- | --- |
| "an MCP endpoint (`/mcp`, stateless Streamable HTTP)... and a WebSocket endpoint (`/ws`)... one Durable Object per Room" (`igv:README.md:12`) | Matches `igv:server/src/index.ts:42-62`, `:125-128` |
| "Each MCP session is bound to a Room whose short id is minted on `initialize`" (`igv:README.md:13`) | Matches the code, but the binding is vestigial (see above) |
| "with no ack within 15 seconds" (`igv:README.md:18`) | Matches `igv:server/src/room.ts:14` |
| Project layout: "`src/tools.ts` The MCP tools (open_viewer)" (`igv:README.md:134`) | Out of date. `tools.ts` registers 14 tools, and the layout omits `commandTools.ts`, `catalogues.ts`, `genomes.ts` |
| Viewer at `https://igv-bot-dev.3dg.io/` (`igv:README.md:99`) | Not yet true; the README itself says so at `:106`, and `VIEWER_URL` is the `pages.dev` address (`igv:server/wrangler.toml:66`). The release checklist still names the custom domain (`igv:docs/release-checklist.md:3,13`) |
| Hosts supported (`igv:README.md:5`) | Unverified. Host behaviour, not code |
| The Join card's status line | Uses Claude desktop wording in every Host ("if Claude then asks", `igv:server/src/joinCard.ts:55-57`); recorded as a known fault in Codex mode (`igv:docs/v1-design.md:136`) |

### 2.2 juicebox-mcp ("Juicebot")

#### Stack

| Item | Value | Source |
| --- | --- | --- |
| Language | Plain JavaScript, ESM, "no TypeScript, no linter" | `jb:CLAUDE.md:81` |
| Layout | npm workspaces: `packages/remote`, `packages/server` | `jb:package.json:23-26` |
| Runtime | Cloudflare Worker, `compatibility_date = "2024-12-01"`, `nodejs_compat` | `jb:packages/server/wrangler.toml:3-4` |
| MCP SDK | `@modelcontextprotocol/sdk` `^1.22.0`; 1.32.0 installed (the lockfile is gitignored, `jb:.github/workflows/test.yml:4`) | `jb:packages/server/package.json:14` |
| Schema library | zod `^3.25.76` | `jb:packages/server/package.json:16` |
| Other server deps | `qrcode`, `@aidenlab/juicebox-remote` (for the shared protocol) | `jb:packages/server/package.json:13-15` |
| Browser library | `@aidenlab/juicebox-remote` `2.0.1-next.3`, plain ESM with no build step, published to npm (`latest` 2.0.0, `next` 2.0.1-next.3 per `npm view` on 2026-10-13); peer dependency `juicebox.js >=4.10.0-mcp.1 <5` | `jb:packages/remote/package.json:3,36-38` |
| The page | juicebox-web, a separate repository, not vendored | `jb:README.md:12` |
| The viewer | A fork build of juicebox.js on the npm dist-tag `mcp` (4.10.0-mcp.2 per `npm view`; `latest` is 4.9.0) | `jb:CLAUDE.md:12` |

#### Transport, hosting, installation, auth

- **Transport**: the same as igvjs-mcp. Stateless Streamable HTTP with JSON responses; `GET /mcp` is 405; a fresh `McpServer` per request (`jb:packages/server/src/index.js:103-108`, `:136-148`). An earlier Node and stdio server was removed (`jb:docs/adr/0001-worker-only-server.md`).
- **Hosting**: three Worker environments in one `wrangler.toml`:

| Environment | Worker | Address | Join links open | Source |
| --- | --- | --- | --- | --- |
| top level | `juicebox-mcp` | `jbmcp.3dg.io` | `https://aidenlab.org/juicebox/` | `jb:packages/server/wrangler.toml:1-9,51` |
| `v2` (frozen demo, "do not redeploy") | `juicebox-mcp-v2` | `*.workers.dev`; `juicebot-mcp.3dg.io` is said to be a custom domain of it | `https://juicebox-v2.3dg.io/` | `jb:packages/server/wrangler.toml:71-98`, `jb:docs/local-testing.md:211-213` |
| `dev` | `juicebot-mcp-dev` | `juicebot-mcp-dev.3dg.io` | `https://juicebot-dev.3dg.io/` | `jb:packages/server/wrangler.toml:122-141` |

- **Auth**: none ("Streamable HTTP, no auth", `jb:README.md:18`). `/ws` checks `Origin` against `ALLOWED_ORIGINS` (`jb:packages/server/src/index.js:83-86`).
- **Install in Claude**: custom connector with the `/mcp` URL; Claude Code `claude mcp add --transport http`; `mcp-remote` as a stdio bridge (`jb:README.md:20-33`).
- **Install in ChatGPT**: the README lists ChatGPT as a client (`jb:README.md:3`) but gives no ChatGPT steps, and the deploy wizard's client stages are Claude Desktop, Claude Code and `mcp-remote` only (`jb:scripts/deploy-wizard.sh:389-417`). ChatGPT support in this repo is a code path (`x-openai-session`, below) and one test (`jb:packages/server/test/mcp.test.js:110`). igvjs-mcp's notes record that "Juicebot is added the same way" in ChatGPT desktop Codex mode and showed in its Side panel (`igv:docs/v1-design.md:105-110,131`).
- **A Claude Code plugin exists elsewhere.** `jb:docs/local-testing.md:211-213` says "The Claude Code juicebot plugin and Claude Desktop connectors point at `juicebot-mcp.3dg.io`", and the unmerged instructions branch names `github.com/aidenlab/plugins`. I did not inspect that repository. Unverified.

#### Tools, resources, prompts

32 tools, pinned by `jb:packages/server/test/fixtures/prototype-tools.json` (the name is historical). Every tool has a `title`. No tool has `annotations`. No prompts. No `instructions` on `main`.

*Panel* in the table means the tool takes `panel`: a 1-based position from the left, a map name unique among the panels, or `"all"`; it is required when more than one panel is open (`jb:packages/server/src/mcp/toolHandlers.js:33-36`, `jb:docs/adr/0007-panels-addressed-by-position.md`).

| Tool | Inputs | Kind | Source (`toolHandlers.js`) |
| --- | --- | --- | --- |
| `get_juicebox_url` | none | Local. Returns the Join link for the session's room; carries the join card `_meta` | `:558-600` |
| `join_room` | `room` (10-character id) | Local. Rebinds the MCP session to another room | `:603-621` |
| `load_map` | `url`, `name?`, `normalization?`, `locus?`, `panel?` (also `"new"`) | Command | `:121-134` |
| `load_control_map` | `url`, `name?`, `normalization?`, `panel?` (one) | Command | `:144-155` |
| `close_panel` | `panel?` (one) | Command | `:136-142` |
| `load_session` | `sessionData?`, `sessionUrl?`, `fileContent?` | Command (the Worker may fetch `sessionUrl`) | `:157-170`, `:60-95` |
| `goto_locus` | `locus` (string or `{chr, start?, end?}`), `panel?` | Command | `:338-365` |
| `zoom_in`, `zoom_out` | `centerX?`, `centerY?`, `panel?` | Command | `:172-194` |
| `set_map_foreground_color` | `color` (`#rrggbb`), `threshold?`, `panel?` | Command | `:196-207` |
| `set_map_background_color` | `color`, `panel?` | Command | `:209-216` |
| `set_color_scale` | `action` (`increase`, `decrease`, `set`), `value?`, `panel?` | Command | `:218-235` |
| `select_normalization` | `normalization`, `panel?` | Command | `:252-262` |
| `load_track` | `url` (or the keyword `"genes"`), `name?`, `color?`, `panel?` | Command | `:237-250` |
| `remove_track` | `track` (name or 1-based index, as a string), `panel?` | Command | `:264-273` |
| `set_track_color` | `track`, `color?`, `panel?` | Command | `:275-287` |
| `set_track_name` | `track`, `name`, `panel?` | Command | `:289-299` |
| `set_track_data_range` | `track`, `min`, `max`, `panel?` | Command | `:301-312` |
| `set_track_autoscale` | `track`, `enabled` (default true), `panel?` | Command | `:314-324` |
| `set_track_log_scale` | `track`, `enabled` (default true), `panel?` | Command | `:326-336` |
| `list_tracks` | `panel?` (one) | Request to the first live page | `:462-477` |
| `list_panels` | none | Request | `:480-492` |
| `save_session` | `filePath?` (ignored) | Request; returns session JSON as text | `:1005-1031` |
| `create_shareable_url` | none | Request, then TinyURL shortening on the Worker | `:495-529` |
| `search_map_catalogs` | `query`, `source?`, `limit?` | Local; curated ENCODE and 4DN contact-map lists | `:799-847` |
| `search_encode_hic` | `biosample?`, `assay?`, `classification?`, `assembly?`, `query?`, `limit?` | Local; live ENCODE portal | `:852-875` |
| `search_encode` | `type?`, `query?`, `filters?`, `limit?` | Local; live ENCODE portal | `:878-899` |
| `get_map_details` | `source`, `index?`, `url?` | Local | `:956-1002` |
| `get_data_source_statistics` | `source` | Local | `:902-953` |
| `list_data_sources` | none | Local | `:769-787` |
| `juicebox_help` | none | Local; returns a usage guide | `:624-766` |
| `get_server_status` | none | Local; session id, room, whether a page is connected | `:532-553` |

Three resources: `ui://juicebox/join` (the join card, `text/html;profile=mcp-app`), and `juicebox://datasource/4dn` and `juicebox://datasource/encode` as JSON (`jb:packages/server/src/mcp/toolHandlers.js:429-442`).

**The unmerged branch `origin/feat/server-instructions`** (three commits ahead of `main`) adds a roughly 400-word `instructions` string to the `initialize` result and sets `serverInfo.title` to "JuiceBot". Its comment reads: "`name` stays "juicebox-server" because tool prefixes derive from it" (`git show origin/feat/server-instructions:packages/server/src/mcp/serverInfo.js`). So the Juicebot authors have already reached for `instructions` as the way to teach workflow to "connector-only users (ChatGPT, Codex, Claude connectors)".

#### How a tool call reaches juicebox.js, end to end

1. The Host posts to `/mcp`. The effective session id is the `mcp-session-id` header, or else an HMAC of `x-openai-session` (`jb:packages/server/src/index.js:131-165`). On `initialize` a minted room id is returned as `mcp-session-id` (`:189-193`).
2. `roomForSession` resolves the room: the room `join_room` stored for this session in an `McpSession` Durable Object, or else the session id itself (`jb:packages/server/src/room.js:22-31`, `jb:packages/server/src/durableObjects/McpSession.js:9-17`).
3. `get_juicebox_url` returns `BROWSER_URL?room=<room>` as text, as a `resource_link`, and as `structuredContent {room, joinUrl, qrPng}` (`jb:packages/server/src/mcp/toolHandlers.js:567-599`). Its description carries the same built-in-browser instructions igvjs-mcp copied (`:563`).
4. The join card is the same MCP App pattern and the same pinned `ext-apps@1.7.5` client (`jb:packages/server/src/mcp/juiceboxView.js:14`). Its QR code and link are "switched off, not removed" (`:38-45`).
5. The page is juicebox-web, which calls `attachRemote({hic, container, url, room, ...})` from `@aidenlab/juicebox-remote` when built with `VITE_WS_URL` (`jb:README.md:12`; `js/roomWidget.js:74` in the local juicebox-web checkout). The remote opens the WebSocket, sends `join`, and on `joined` asks the room for its state (`jb:packages/remote/src/attachRemote.js:62-64`, `:77-85`).
6. A command tool calls the room's `send(tool, command)` over RPC. The room first sends every page a `toolCall {name}` notice, then the command as a flat message `{type: "gotoLocus", ..., requestId}`, and waits up to 10 seconds for the first ack (`jb:packages/server/src/durableObjects/WebSocketRoom.js:6`, `:48-55`, `:85-110`).
7. The remote runs commands one at a time in arrival order through `applyCommand`, which calls juicebox.js's public surface (`browser.loadHicFile`, `browser.parseGotoInput`, `browser.loadTracks`, `hic.restoreSession`), and acks `{requestId, ok, result?, error?}` (`jb:packages/remote/src/attachRemote.js:111-132`, `jb:packages/remote/src/applyCommand.js:44-118`).
8. The tool result is a progress sentence plus, for panel commands, one line per panel from the ack (`jb:packages/server/src/mcp/toolHandlers.js:397-410`). It does not carry a summary of the view; the model asks with `list_panels` and `list_tracks`.

#### State and session model

- **Room bound to the MCP session**, rebindable with `join_room`; the binding is server state in a second Durable Object class (above).
- **Several pages per room are a first-class feature.** A change made by hand in one page is sent as a sync event and relayed to every other page in the room (`jb:packages/server/src/durableObjects/WebSocketRoom.js:177-187`, `jb:packages/remote/src/protocol.js:53-72`). A late joiner is caught up from the first live peer, else from the room's stored session (`WebSocketRoom.js:116-130`).
- **A page can start a room with no MCP client**: `/ws` with no `room` mints one (`jb:packages/server/src/index.js:88`).
- **The page saves its compressed session to the room** every 10 seconds when it changed (`jb:packages/remote/src/attachRemote.js:10`, `:155-160`).
- **Expiry**: an alarm 24 hours after the last message deletes the room's storage, and marks it expired if no page is connected (`WebSocketRoom.js:213-219`). There is no renew.
- **Multiple viewers inside one page**: panels, addressed by position (ADR-0007, ADR-0008).

#### Tests and docs

- About 68 server tests and 189 remote tests (counts of `it(`; approximate), run on every push by GitHub Actions (`jb:.github/workflows/test.yml`). The remote is tested against a fake juicebox.js; there is no browser round trip in this repo.
- Issues are local markdown under a gitignored `.scratch/` (`jb:CLAUDE.md:98`), so they are not visible in the repository.

#### README and doc claims checked against the code

| Claim | Verdict |
| --- | --- |
| "The server is `https://jbmcp.3dg.io/mcp`" (`jb:README.md:18`) | Matches `wrangler.toml:7-9`. But `jb:CLAUDE.md:30` calls that "the prototype Worker", and `jb:docs/local-testing.md:211-213` says the plugin and Claude Desktop connectors point at `juicebot-mcp.3dg.io`. Which endpoint real users are on is not settled by the repo. Unverified |
| `juicebot-mcp.3dg.io` is a custom domain of `juicebox-mcp-v2` (`jb:docs/local-testing.md:212`) | Not in `wrangler.toml`, where `[env.v2]` has `routes = []` and `workers_dev = true` (`:84-85`). Presumably attached outside the file. Unverified |
| The tools table (`jb:README.md:41-57`) | Matches the 32 registered tools |
| "Run everything locally... juicebox.js 4.6.0... `aidenlab-juicebox-remote-2.0.0.tgz`" (`jb:README.md:61-76`) | Out of date against the peer dependency `>=4.10.0-mcp.1` and remote `2.0.1-next.3`. `jb:docs/local-testing.md` is the current procedure |
| `save_session`: "On local server, saves to a file" and a `filePath` input (`toolHandlers.js:1009-1011`) | Stale. There is no local server (ADR-0001) |
| `juicebox_help`: "I'll give you a URL with a QR code" (`toolHandlers.js:640`) | Stale. The QR is switched off in the card and `get_juicebox_url` tells the model not to repeat one |
| "A tool call flows: ... the page (today: nothing, the prototype frontend is gone...)" (`jb:CLAUDE.md:47`) | Stale. juicebox-web attaches the remote |
| `packages/connector-mcpb/` planned (`jb:docs/design/ARCHITECTURE_V2.md:222`) | Not in the repo |
| "ack ... waits up to 10 s" (`jb:CLAUDE.md:45`) | Matches `WebSocketRoom.js:6` |

## 3. Comparison

### 3.1 Side by side

| Aspect | igvjs-mcp | juicebox-mcp | Same? |
| --- | --- | --- | --- |
| Worker with `POST /mcp` and `/ws`, Durable Object per room, WebSocket Hibernation API | Yes (`igv:server/src/room.ts:36-41`) | Yes (`jb:.../WebSocketRoom.js:24-30`) | Same |
| Fresh `McpServer` per request, stateless transport, JSON responses, `GET` is 405 | Yes | Yes | Same |
| stdio, SSE | None | None | Same |
| Auth | None; `Origin` allow-list on `/ws` | None; `Origin` allow-list on `/ws` | Same |
| Room id | 10 Crockford base32 characters (`igv:server/src/roomId.ts:1-14`) | The same function, copied (`jb:.../index.js:24-36`) | Same |
| ChatGPT path | HMAC of `x-openai-session` under `SESSION_HMAC_SECRET` | The same | Same |
| Join card | MCP App, `ext-apps@1.7.5` from unpkg, `ui/open-link` | The same | Same pattern, separate copies |
| "Open in the built-in browser, never Claude in Chrome" wording | Copied from juicebox (`igv:server/src/tools.ts:136-137`) | Original | Same |
| Command tools as rows of a table registered in a loop | `COMMAND_TOOLS` (`igv:server/src/commandTools.ts:24`) | `COMMAND_TOOLS` (`jb:.../toolHandlers.js:119`) | Same idea, different row shape |
| 24-hour room expiry by alarm | Yes | Yes | Same idea; igv re-arms while a Viewer is connected and can renew, jb cannot |
| Language | TypeScript | JavaScript | **Differs** |
| zod | 4 | 3 | **Differs** (major version) |
| SDK range | `^1.32.1` | `^1.22.0` | Compatible; both resolve to 1.32.x |
| Worker `compatibility_date` | 2026-08-01 | 2024-12-01 | **Differs** |
| Durable Object storage backend | `new_sqlite_classes` (`igv:server/wrangler.toml:18`) | `new_classes` (`jb:.../wrangler.toml:41,45`) | **Differs** |
| How a call finds its room | `room` argument on every tool; `open_viewer` mints per call | MCP session id; `join_room` rebinds; extra `McpSession` Durable Object | **Differs, and deliberately** |
| Message to the page | `{type: "command", id, command: {type: "go_to_locus", ...}}` | `{type: "gotoLocus", ..., requestId}` | **Differs** |
| Ack | `{type: "ack", id, ok, summary, error?, shareableUrl?}` | `{type: "ack", requestId, ok, result?, error?}` | **Differs** |
| Ack timeout | 15 s | 10 s | Differs |
| What a reply tells the model | The full Session summary, every time | A progress sentence; state is asked for separately | **Differs** |
| Several pages in a room | Tolerated, not kept in step | Kept in step by relayed sync events; peer catch-up | **Differs** |
| A page starting its own room | No; `/ws` without a valid `room` is 400 (`igv:server/src/index.ts:49`) | Yes | Differs |
| Who owns the page | This repo (`viewer/`) | juicebox-web, another repo; control layer is a published npm package | **Differs** |
| Who owns the viewer library | Published `igv`, "not a fork" (`igv:docs/v1-design.md:19`) | A fork build of juicebox.js on a dist-tag | **Differs** |
| Several viewers in one page | No | Yes (panels) | Differs |
| Share link | Long igv-webapp URL built in the Viewer | Snapshot link shortened through TinyURL with a Worker secret | Differs |
| Search | 1 tool; track tables; Hi-C maps excluded | 6 tools; contact-map lists and the live ENCODE portal | Complementary |
| Server name | `igv-bot` 0.0.0 | `juicebox-server` 1.1.0, with an icon | Differs |
| Deployed stacks | 1 (dev) | 3 | Differs |
| CI | None | GitHub Actions tests; npm publish workflow for the remote | Differs |
| Issue tracker | GitHub Issues | Local gitignored markdown | Differs |
| Browser round-trip tests | Yes (Playwright) | No | Differs |

### 3.2 Tool name collisions

Exact collisions, with incompatible schemas:

| Name | igvjs-mcp | juicebox-mcp |
| --- | --- | --- |
| `zoom_in` | `room?` only | `centerX?`, `centerY?`, `panel?` |
| `zoom_out` | `room?` only | `centerX?`, `centerY?`, `panel?` |
| `remove_track` | `name?` or `position?` (number), `room?` | `track` (string: name or index), `panel?` |

Near-duplicates that a model would have to tell apart:

| Purpose | igvjs-mcp | juicebox-mcp | Difference that matters |
| --- | --- | --- | --- |
| Open the viewer | `open_viewer` | `get_juicebox_url` | igv mints a Room per call and takes `genome`, `locus`; jb returns the session's room |
| Navigate | `go_to_locus`, `go_to_gene` | `goto_locus` | jb accepts gene names and an object form, and a locus is two-dimensional |
| Load a track | `load_tracks` (array) | `load_track` (one; `"genes"` keyword; colour) | Batch against single |
| Share | `get_shareable_url` | `create_shareable_url` | igv-webapp link against a shortened juicebox link |
| Read state | `read_session_summary` | `list_panels`, `list_tracks`, `save_session` | One summary against three tools |
| Search | `search_catalogues` | `search_map_catalogs`, `search_encode_hic`, `search_encode` | Tracks against maps; note also the spelling "catalogues" against "catalogs" |
| Attach to a room | the `room` argument | `join_room` | Two models of the same thing |

Resource URIs do not collide (`ui://igv-bot/join`, `ui://juicebox/join`, `juicebox://datasource/*`).

Size of the union, measured from the two fixtures: 46 tools; the tool definitions serialise to about 17,600 + 24,500 = 42,100 characters, which is roughly 10,500 tokens at four characters a token (an estimate, not a tokenizer count). No single description exceeds 2,048 characters; the longest is `search_catalogues` at 1,335.

### 3.3 Incompatible assumptions

1. **Room binding.** This is the substantive one. igvjs-mcp's ADR rejects the juicebox approach by name: "A `join_room` tool, as in `juicebox-mcp`... Rejected: the model cannot tell that its MCP session has changed, so the first command after the change still fails before it knows to call `join_room`" (`igv:docs/adr/0003-the-model-carries-the-room-id.md:14`). Inferred, not tested: juicebox-mcp is exposed to the same Claude desktop two-session behaviour that prompted that ADR, because its commands go to the calling session's room (`jb:packages/server/src/room.js:26-31`).
2. **Tool descriptions and replies name other tools.** Examples: "as given in the reply of open_viewer" (`igv:server/src/tools.ts:44`); "use change_genome, go_to_locus or go_to_gene" (`:175`); "call read_session_summary first" (`igv:server/src/commandTools.ts:87`); "Use get_juicebox_url to get the join link" (`jb:.../toolHandlers.js:389`); "use search_encode_hic instead" (`:803`); "pass `maps[].url` to load_map" (`:856`). Renaming a tool without rewriting this text leaves the model pointed at names that do not exist.
3. **Product names are baked into text.** "igv-bot" and "Juicebox" appear throughout descriptions, replies, the cards, and the Viewer's status line (`igv:viewer/src/main.ts:119`).
4. **Both tool contracts are pinned by fixture tests** (`igv:server/test/mcp.test.ts:218-223`; `jb:CLAUDE.md:77`: the fixture "changes only when the contract deliberately does"). A rename is a deliberate contract change in either repo.
5. **TypeScript against JavaScript, zod 4 against zod 3.** zod 3 and zod 4 schemas are different object models; one `registerTool` call site cannot take both without care. I did not test whether SDK 1.32 accepts a mix in one server. Unverified.
6. **Reply conventions.** igv's "Session summary with every reply" and juicebox's "ask when you need it" give the model different habits; in one tool list the model will meet both.
7. **Ownership of the browser side.** juicebox's control layer is a published package consumed by another repository and constrained by juicebox.js's public API (`jb:docs/adr/0002-...md`). Changing its wire protocol means a release of `@aidenlab/juicebox-remote` and a rebuild of juicebox-web. igv's Viewer is in-repo and free to change.
8. **Repository ownership.** igvjs-mcp is `aidenlab/igvjs-mcp`. The juicebox checkout tracks `weiszd/juicebox-mcp` and its recent commits are by David Weisz; it also depends on forks `weiszd/juicebox.js` and `weiszd/juicebox-web` (`jb:README.md:61`, `jb:docs/local-testing.md:44-46`). Changes to juicebox-mcp are not solely the geenee maintainer's to make.

### 3.4 What could be shared

| Piece | Shareable as is? | Notes |
| --- | --- | --- |
| Room id minting, parsing, HMAC derivation | Yes | Already the same function in two languages |
| `/mcp` request handling (CORS, 405, per-request server, `mcp-session-id` patching) | Yes | Near-identical (`igv:server/src/index.ts:81-144`, `jb:.../index.js:123-205`) |
| `/ws` Origin check and routing | Yes | Differ only on minting a room when none is given |
| Join card | Yes, with a name and wording parameter | Same HTML and client |
| The command-tool loop (table row to `registerTool`, ack to result) | With a common row shape | jb rows have `rgb`, `command`, `failure`, `text`; igv rows have `genomeArgument` |
| Room Durable Object | Partly | The command and ack core is common. jb adds peer relay, catch-up and the `toolCall` notice; igv adds summary storage, `startOn`, `renew` |
| Catalogue search | Partly | Both fetch `raw.githubusercontent.com/igvteam/igv-data` (`igv:server/src/catalogues.ts:199`; `jb:.../search/catalogs.js:14,32`), different tables and different matchers. igv's matcher has no synonyms by decision (`igv:docs/v1-design.md:74`); jb's has a synonym dictionary (`jb:CLAUDE.md:56`) |
| Wire protocol to the page | No | Different shapes; jb's is published |
| Browser-side command appliers | No | One is igv.js calls, the other juicebox.js calls |

### 3.5 How igv.js and juicebox.js relate, where it bears on routing

- **juicebox.js embeds igv.js.** juicebox.js 4.10.0-mcp.1 declares `"igv": "3.8.9"` (`package.json:61` in the `weiszd/juicebox.js` fork), the version the igv-bot Viewer has installed. juicebox's `load_track` hands igv-format files to `browser.loadTracks` (`jb:packages/remote/src/applyCommand.js:118`) and its description lists "bigWig, bigBed, bedGraph, bed, bedpe, interact" (`jb:.../toolHandlers.js:239`).
- **So the track vocabulary overlaps.** A URL that `search_catalogues` returns for igv-bot is, by format, loadable into a juicebox panel with `load_track`. Inferred from the formats; not tested.
- **The data splits cleanly by dimension.** igv-bot states "Hi-C contact matrices... are never offered: igv-bot cannot show them" (`igv:server/src/tools.ts:253`) and filters them out (`igv:docs/v1-design.md:84`). juicebox's map searches return `.hic` files. This is a real routing signal: a `.hic` URL means juicebox; a one-dimensional signal or annotation on its own means igv.
- **But the overlap zone is where a model will hesitate.** "Go to MYC", "zoom in", "load the CTCF track", "remove the second track", "give me a link" are valid in both viewers. With both open, the request alone does not say which is meant.
- **Shared tools are plausible for search and for locus hand-off.** igv's Session summary gives `genome` and `loci` (`igv:viewer/src/protocol.ts:87-94`); juicebox's `list_panels` gives genome and locus per panel (`jb:.../toolHandlers.js:484`). "Show this region in the other viewer" is expressible with what exists.
- **Genome naming differs between sources.** igv notes that ENCODE and 4DN name assemblies differently from the igv.org list (`igv:docs/v1-design.md:76`); juicebox's search takes `assembly` such as "GRCh38" (`jb:.../toolHandlers.js:861`). A shared search would need one mapping.

## 4. MCP mechanisms relevant to "expose a tool set based on context"

### 4.1 Which specification applies

- The current revision is 2026-07-28 (https://modelcontextprotocol.io/specification/versioning). It "remove[s] protocol-level sessions and the `Mcp-Session-Id` header" and "the `initialize`/`notifications/initialized` handshake" (https://modelcontextprotocol.io/specification/2026-07-28/changelog, major changes 1 and 2).
- Both servers use SDK v1, whose newest revision is 2025-11-25 (section 2.1). The SDK's v2 line is published as `@modelcontextprotocol/server` (2.3.1 on npm on 2026-10-13) and described as "the stable release line, implementing the 2026-07-28 MCP spec"; v1 "continues to receive bug fixes and security updates for at least six months after the v2 release (2026-07-27)" (https://github.com/modelcontextprotocol/typescript-sdk, as summarised by the fetch tool).
- A server may be "dual-era", answering both `initialize` clients and per-request-metadata clients (https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning).
- Claude's connector documentation lists the authorization specifications it follows as 2025-03-26, 2025-06-18 and 2025-11-25 (https://claude.com/docs/connectors/building/index). Claude Code's documentation refers to "connections that use protocol revision 2026-07-28" (https://code.claude.com/docs/en/mcp). Which revision claude.ai, Claude desktop and ChatGPT send to a custom connector today: unverified.

### 4.2 What the specification says

| Mechanism | Specified behaviour | Source |
| --- | --- | --- |
| Tool names | "SHOULD be between 1 and 128 characters"; letters, digits, `_`, `-`, `.`; "SHOULD be unique within a server" | https://modelcontextprotocol.io/specification/2026-07-28/server/tools (also in 2025-11-25) |
| Namespacing | No namespace construct. For aggregation: "Clients or proxies that aggregate tools from multiple servers MAY encounter naming collisions... and SHOULD implement a disambiguation strategy such as prefixing tool names with a server identifier. The server `name`... SHOULD NOT be relied upon for disambiguation." (2026-07-28 only) | same |
| Tool list may change | The set "MAY be empty and MAY change over time" | same |
| Tool list must not depend on the connection | "MUST NOT vary per-connection or as a side effect of other requests on the connection. The set MAY vary by the authorization presented on the request" (2026-07-28). The 2025-11-25 page has no such sentence | same; https://modelcontextprotocol.io/specification/2025-11-25/server/tools |
| `list_changed` | Servers that declared `listChanged` "SHOULD send a notification". In 2026-07-28 only to clients that opened a `subscriptions/listen` stream; in 2025-11-25 on the session's stream | same two pages |
| Ordering | "Servers SHOULD return tools in a deterministic order", for client caching and prompt cache hits | 2026-07-28 tools page |
| `instructions` | 2025-11-25: an optional field of the `initialize` result. 2026-07-28: a field of `server/discover`'s result, "Optional natural-language guidance for LLMs on how to use this server effectively" | https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle; https://modelcontextprotocol.io/specification/2026-07-28/server/discover |
| Annotations | Hints only: "clients MUST consider tool annotations to be untrusted unless they come from trusted servers" | tools page |
| State across calls | "MCP has no protocol-level session... Servers that need to maintain state across calls... should do so by returning an explicit handle from a creation tool and accepting that handle as an argument on subsequent calls." The retention policy "should be stated in the creation tool's description"; an expired handle "should return a tool execution error" (non-normative guidance, 2026-07-28) | tools page, "Stateful Tools" |
| Identifying the client | `serverInfo` "is intended for display, logging, and debugging. Clients SHOULD NOT use it to change their behavior". I did not find, in the pages read, an equivalent statement about servers branching on `clientInfo` | https://modelcontextprotocol.io/specification/2026-07-28/server/discover |
| UI | MCP Apps is an optional extension (`io.modelcontextprotocol/ui`): a tool names a `ui://` resource in `_meta.ui.resourceUri` and the Host renders it in a sandboxed iframe | https://modelcontextprotocol.io/extensions/apps/overview |

Consequences for the two servers, inferred:

- The "Stateful Tools" guidance is igvjs-mcp's `room` design almost word for word, including the 24-hour expiry and the expired-handle error. juicebox-mcp's session-bound room, `join_room`, and both servers' minting of a room id into `mcp-session-id` rely on a header the current revision removes.
- Neither server can send `list_changed` today: every request gets a new server object and `GET /mcp` is refused, so there is no stream to send it on (`igv:server/src/index.ts:55-60`, `jb:.../index.js:103-108`). The SDK does have the API (`RegisteredTool.enable()`, `.disable()`, `.remove()`, `sendToolListChanged()`, `node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts:217,287-300`), but it presumes a long-lived server instance.
- A tool list that changes after `open_viewer` is called ("now show the igv tools") would be a list that varies "as a side effect of other requests", which the current revision forbids for a connection. It could only be done per room or per authorization, and the server does not know the room at `tools/list` time.

### 4.3 What the server can actually see

Read from the two servers' code and notes, the server receives per request: the JSON-RPC body, `mcp-session-id`, `x-openai-session` (sometimes), `mcp-protocol-version`, and in Claude an `x-anthropic-client` header that igvjs-mcp logged as `ClaudeAI` for the chat and `Cowork` for the agent runtime (`igv:docs/adr/0003-the-model-carries-the-room-id.md:3`). igvjs-mcp concluded: "No header the Host sends identifies the Conversation" in Claude, and "`mcp-session-id` is per client and `traceparent` is per request" (`:3`, `:13`). OpenAI documents `_meta["openai/session"]` on tool calls as "an anonymized conversation ID" and warns that `openai/userAgent` is "not a reliable way to detect the host surface" (https://developers.openai.com/apps-sdk/reference, as summarised). Neither server reads `_meta`; both read only the header.

So the server never sees what the user asked. "Context" in the sense of "the user is talking about contact maps" exists only in the model. Any contextual routing is therefore either the model choosing among tools it can see, or the client hiding tools from the model until they are searched for.

### 4.4 What the clients do

| Behaviour | Claude | ChatGPT | Status |
| --- | --- | --- | --- |
| Add a remote server by URL with no auth | Custom connector; "with no authentication at all" is supported (https://claude.com/docs/connectors/building/index) | "Add custom MCP server" under ChatGPT Plugins, public endpoint or Secure MCP Tunnel, "Create as a plugin" (https://developers.openai.com/apps-sdk/deploy/connect-chatgpt, as summarised) | Documented. Note the OpenAI page did not, as summarised, state plan or surface limits; igvjs-mcp observed the option only in Codex mode on desktop (`igv:docs/v1-design.md:131`). Unverified which is current |
| Transports | Streamable HTTP; legacy HTTP+SSE "being deprecated" (same Claude page) | "Support the MCP streamable HTTP transport" (https://developers.openai.com/apps-sdk/build/mcp-server, as summarised) | Documented |
| Where it connects from | One connector serves "claude.ai, Claude Desktop, Claude mobile, Cowork, and Claude Code, and the same connector infrastructure backs all of them" (same Claude page) | Not read | Documented for Claude |
| Features | Tools, prompts, resources. Not supported: "Resource subscriptions", "Sampling", "Advanced or draft capabilities" (same Claude page) | Not enumerated in the pages read | Documented for Claude |
| Server `instructions` | Claude Code: "Only tool names and server instructions load at session start"; truncated "at 2,048 characters by default" (https://code.claude.com/docs/en/mcp). claude.ai and desktop chat: not stated in the pages read | ChatGPT and Codex use it "alongside tool metadata"; "Keep the most important details in the first 512 characters" (https://developers.openai.com/apps-sdk/build/mcp-server, as summarised) | Documented for Claude Code and ChatGPT; **unverified for claude.ai and Claude desktop chat** |
| Tool search and deferred loading | Claude Code: on by default; "MCP tools are deferred and discovered on demand"; a tool can opt out with `_meta["anthropic/alwaysLoad"]` (same Claude Code page). Claude API: `defer_loading` and a tool search tool (https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool) | Not mentioned in the pages read | Documented for Claude Code and the API; **unverified for claude.ai and Claude desktop chat; unverified for ChatGPT** |
| `list_changed` honoured | Claude Code: "fetches the updated list from that server" (same Claude Code page). claude.ai and desktop chat: not stated | Not mentioned. Refresh is manual: after changing tools, open the connection "and select Refresh... then start a new conversation" (https://developers.openai.com/apps-sdk/deploy/connect-chatgpt, as summarised) | Documented for Claude Code; **unverified elsewhere**; ChatGPT documents manual refresh only |
| Tool name prefixing by the client | Claude Code prefixes with the server name (`mcp__<server>__<tool>`; documented explicitly for plugin servers and for prompts on https://code.claude.com/docs/en/mcp). claude.ai: not stated | Not stated | Partly documented. How each Host presents two same-named tools from two connectors to the model: unverified |
| Tool count guidance | "Claude's ability to pick the right tool degrades once you exceed 30–50 available tools"; use tool search when "You have 10 or more tools" or definitions "consume more than 10k tokens"; "prefix by service or resource (for example, `github_`, `slack_`)" (tool search page). Claude Code "doesn't impose a fixed per-server tool cap" | No number given; "pair the domain with the action"; descriptions should "start with 'Use this when…'" (https://developers.openai.com/apps-sdk/guides/optimize-metadata, as summarised) | Documented guidance, not limits |
| Annotations | "All MCP tools must declare both" `readOnlyHint` and `destructiveHint` (https://claude.com/docs/connectors/building/mcp); for the directory, also `title`, and they "determine auto-permissions" (https://claude.com/docs/connectors/building/review-criteria) | `readOnlyHint`, `destructiveHint`, `openWorldHint` "are required"; they "only change how ChatGPT frames the call to the user" (https://developers.openai.com/apps-sdk/reference, as summarised) | Documented. **Neither server sets any.** Both evidently work as custom connectors without them, so "must" is not enforced there (inferred from the repos' recorded use) |
| Limits | Tool result about 150,000 characters; "240 seconds per tool call" on claude.ai and desktop; names "64 characters or fewer" for the directory (Claude pages above) | Status strings 64 characters (reference page) | Documented |
| Description content rules | Directory review rejects descriptions that "Instruct Claude to call external software or tools the user didn't request" or "Tell Claude to behave in ways unrelated to the tool's function" (review-criteria page) | Not read | Documented for the Claude directory only. `open_viewer` and `get_juicebox_url` both instruct browser use and reply style in their descriptions, which bears on any future directory listing |
| User-side selection | The user toggles each connector per conversation and can block individual tools (https://claude.com/docs/connectors) | The user types "@" and selects the plugin (connect-chatgpt page, as summarised) | Documented. This is the nearest thing either Host has to "the user says which one they want", and it works per connector, not per tool group |
| MCP Apps | Claude web and Claude Desktop | ChatGPT; `_meta.ui.resourceUri` is "preferred", `openai/outputTemplate` is an alias | https://modelcontextprotocol.io/extensions/client-matrix (community-maintained); OpenAI reference page |

### 4.5 What this leaves as real mechanisms

1. **Static exposure, model-side routing.** Both tool sets are always listed. The routing signals are tool names (a prefix per viewer), the first sentence of each description, and server `instructions`. This is specified and works in every Host, with the caveat that claude.ai chat's use of `instructions` is unverified.
2. **Client-side deferral.** The Host hides definitions until the model searches. Documented only for Claude Code and the API. A server can cooperate (consistent prefixes, keywords, `anthropic/alwaysLoad` on the few entry tools) but cannot cause it.
3. **Separate connectors.** The user turns one on. This is the only user-facing, Host-supported selection, and it is what exists today.
4. **Server-side list changes.** Permitted over time, forbidden per connection in the current revision, not deliverable by either server as built, and manual in ChatGPT.
5. **Fewer, broader tools (a tool-design pattern, not a protocol feature).** For example one `open_viewer(viewer)` and viewer-specific tools behind a `viewer` argument, or a dispatcher tool. This moves routing into arguments. It is outside what the specification says either way; its cost is weaker per-tool schemas and descriptions, and its effect on model accuracy here is untested.

## 5. Design options for geenee

The geenee repository today is the default Vite template with one commit (`5a2a68a`), `typescript ~6.0.2` and `vite ^8.3.0`, the same pair as the igv-bot Viewer, and no server code (`package.json`, `src/main.ts`).

### (a) One server statically exposing both tool sets, namespaced

**What it is.** One Worker, one connector URL, one `tools/list` holding the igv tools and the juicebox tools under distinguishing names, plus `instructions` that say which set is for what.

**What changes in the existing code.**
- A new Worker entry that registers both catalogues. The two `registerTools` functions cannot simply both be called: three names collide (section 3.2), and one is TypeScript on zod 4, the other JavaScript on zod 3 (section 3.3).
- Renaming means editing descriptions and reply strings that name other tools (section 3.3, item 2) and updating both fixtures.
- One room-binding model has to be chosen. If juicebox tools gain a `room` argument, `join_room` and the `McpSession` Durable Object become unnecessary; if not, the merged server carries both models and the Claude desktop two-session problem for the juicebox half (inferred).
- Either two Durable Object classes in one Worker (two wire protocols kept), or one generic room. Keeping juicebox's protocol unchanged keeps `@aidenlab/juicebox-remote` and juicebox-web untouched.
- `open_viewer` and `get_juicebox_url` become one tool with a `viewer` argument or stay two. Two Join cards or one parameterised card.
- Viewer origins for both pages on the `/ws` allow-list; rooms move to a new Durable Object namespace, so existing Join links and existing connectors on the old Workers stop reaching new rooms (the same effect `jb:docs/local-testing.md:211-213` describes between its own stacks).

**What breaks.** The tool contracts of both existing servers, for anyone whose connector points at the new server. Existing deployments are unaffected if left running.

**In Claude.** All 46 tools are listed to claude.ai and desktop chat (whether deferred there is unverified). In Claude Code they are deferred behind tool search by default, where a per-viewer prefix lets "one search match the whole group". 46 sits inside the "30–50" range where Anthropic says selection accuracy starts to degrade, and the definitions are near the 10k-token mark.

**In ChatGPT.** All tools listed; adding or renaming needs a manual Refresh and a new conversation. `instructions` are documented as used. Annotations are documented as required.

**Main risks.** Wrong-viewer calls for the overlapping verbs (zoom, go to, remove track, share) when both viewers are open; tool count; the effort of reconciling two languages and two room models before anything can be shown; divergence from the upstream repos once tools are renamed.

**Variation.** Shrink the union while merging: one search surface, one open tool, drop `juicebox_help` and `get_server_status`. That reduces count and overlap but is a redesign of the contract, not a merge.

### (b) One server with dynamic or contextual tool exposure

Three different things go by this name.

**(b1) The list changes with state** (for example only `open_*` and search tools at first; a viewer's tools appear once it is opened).
- Changes: a long-lived or stateful MCP endpoint able to hold a stream, `listChanged: true`, and something to key the state on.
- Problems found: the current specification forbids a list that varies "per-connection or as a side effect of other requests"; the servers have no stream and no conversation identity in Claude; ChatGPT documents manual refresh only; claude.ai chat's handling is unverified; a changing list also defeats the "deterministic order" caching advice.
- In Claude Code it would work as documented. Elsewhere: unverified to not working.

**(b2) The list depends on the URL or credentials** (for example `/mcp?viewers=igv`, or a scope).
- This is permitted ("MAY vary by the authorization presented"). In practice it is separate connectors that share a codebase, selected by the user in the Host. It is static per connector.
- It does not give "one installation", but it does give one codebase and one deployment.

**(b3) Routing moved into arguments** (a small fixed list; `viewer` as an argument; or a describe-then-call dispatcher).
- Changes: a redesigned tool surface; both existing contracts replaced.
- Works identically in every Host because the list is static and small.
- Risks: untested model accuracy with broad tools; loss of the per-tool descriptions that currently carry a lot of behaviour guidance (for example `igv:server/src/commandTools.ts:98`); schema validation moves from the Host to the server.

### (c) A gateway that fronts the two existing servers unchanged

**What it is.** geenee is an MCP server to the Host and an MCP client to `igv-bot-mcp-dev.3dg.io/mcp` and a juicebox endpoint. It lists both upstream tool sets under prefixed names and forwards calls.

**What changes in the existing code.** In principle nothing. In practice:
- **Renaming still bites.** The gateway must prefix at least the three colliding names, and upstream descriptions and replies name upstream tools (section 3.3, item 2). The gateway would have to rewrite text in `tools/list` results and in tool results, or prefix only the colliding names and accept an inconsistent scheme.
- **Rooms.** igvjs-mcp forwards cleanly: its room is an argument. For juicebox-mcp the gateway must present an upstream `mcp-session-id`. Read from the code: juicebox-mcp uses whatever `mcp-session-id` it is sent as the session id, and a session with no `join_room` binding has the room whose id is that session id (`jb:.../index.js:131,164`; `jb:.../room.js:26-31`). So a stateless gateway could add a `room` argument to the juicebox tools and translate it into that header upstream. Inferred from the code; not tested; and it leans on the header the current specification removes.
- **Resources and cards.** The gateway must proxy `resources/read` for both `ui://` URIs and pass tool `_meta` through, or the Join cards disappear.
- **Annotations and instructions** can be added at the gateway without touching upstream.

**What breaks.** Nothing upstream. Upstream contract changes flow through to geenee's users unreviewed unless the gateway pins them.

**In Claude and ChatGPT.** Indistinguishable from (a) to the Host: one static list of the same size, with the same routing risks. An extra network hop per call; both upstream ack waits (10 s and 15 s) are far inside Claude's 240 s.

**Main risks.** Text rewriting is fragile; three codebases to keep in step; the juicebox room trick is undocumented behaviour; it defers rather than removes the redundancy between the two servers. Its strength is speed to a single installation, and that it leaves the juicebox fork owners' code alone.

### (d) A shared core library, the two servers kept separate

**What it is.** Extract what section 3.4 marks shareable into a package both servers depend on. Two connectors remain.

**What changes.** igvjs-mcp and juicebox-mcp each replace their copies of the room id functions, the `/mcp` handler, the Origin check, the card and possibly the command-tool runner and the room core. juicebox-mcp would need either TypeScript-emitted JavaScript from the core or to adopt a build; the zod major versions need aligning; the room cores need a common message envelope or an adapter.

**What breaks.** Nothing for users. No tool is renamed.

**In Claude and ChatGPT.** Exactly as today: two connectors, the user enables the one they want, no cross-viewer collisions inside one list, no shared `room` across viewers.

**Main risks.** It does not deliver "one installation" or "the user just says which one they want" on its own. It needs changes accepted in a repository the geenee maintainer does not solely own. The shared part is small relative to each server's tool and browser code.

**Relation to the others.** (d) is also the internal shape (a) would want: a core, two tool modules, and entry points. The same modules could back one combined entry (a) and, through (b2), single-viewer entries.

### Cross-cutting facts that apply to every option

- **Adopting `room` as an explicit handle for every tool** matches the current specification's guidance and removes the session dependency. igvjs-mcp already does it; juicebox-mcp does not.
- **`instructions` are cheap and documented as used by ChatGPT, Codex and Claude Code.** Budget: critical content in the first 512 characters (OpenAI) and all of it under 2,048 (Claude Code). The Juicebot draft is about 400 words, which is over 2,048 characters.
- **Annotations are missing everywhere** and both vendors document them as required. Most tools here are neither read-only nor destructive in the data sense; they change a view. How to annotate "changes what a viewer shows" is a judgement call the docs read do not settle.
- **The browser side is a separate question from the server side.** Every option above can keep two pages and two Join links. Whether geenee also needs one page is open (section 6).

## 6. Open questions

### For the user to decide

1. **What does "one installation" have to mean?** One connector URL (options a, b3, c), or one codebase and deployment that may surface as more than one connector (b2, d)?
2. **Is the tool contract free to change?** Renaming and consolidating tools breaks the pinned contracts of both servers. Is geenee a new product with its own tool surface, or a front for two existing ones that keep theirs?
3. **Which room model?** Carry `room` on every tool (igv ADR 0003, and the current specification's guidance), or keep juicebox's session binding and `join_room`? Should one `room` be able to hold both an igv Viewer and a juicebox page, so a single handle drives both?
4. **One page or two?** Should the user see igv.js and juicebox.js in one geenee page (the Vite scaffold suggests a web app is intended), or two pages opened by two Join links? This decides whether cross-viewer actions ("show this locus in the contact map") are one room talking to one page, or coordination across two. Note juicebox.js already bundles igv 3.8.9.
5. **What happens when both viewers are open and the request is ambiguous?** Ask, use the most recently opened, or require a `viewer` argument on overlapping tools, as juicebox's ADR-0007 requires `panel` when several panels are open?
6. **Do existing users keep working?** Are the current connectors (`igv-bot-mcp-dev.3dg.io`, `jbmcp.3dg.io`, `juicebot-mcp.3dg.io`, `juicebot-mcp-dev.3dg.io`) kept running beside geenee, and for how long? Rooms do not carry across Workers.
7. **What is the relationship to weiszd/juicebox-mcp?** Depend on it as it is (c), contribute changes to it (d), or copy from it into geenee as igvjs-mcp did (a)? This also covers `@aidenlab/juicebox-remote`, the juicebox.js fork build and juicebox-web.
8. **Which Hosts are in scope for the first version?** igvjs-mcp supports Claude desktop, claude.ai web and ChatGPT desktop in Codex mode only. Option (b1) is documented to work only in Claude Code.
9. **Is the peer sync that juicebox has (several pages in step) wanted for igv too, or dropped for both?** It is the largest behavioural difference between the two rooms.
10. **Should search be unified?** One search surface over tracks and maps, with one genome-naming map, or the four existing search tools kept as they are?
11. **Language for geenee.** The scaffold is TypeScript. Bringing juicebox's JavaScript in means porting, or allowing JavaScript in the build.
12. **Is a directory listing intended, in Claude or ChatGPT?** If so, the annotation requirements and Claude's rule against descriptions that instruct behaviour apply, and the current `open_viewer` and `get_juicebox_url` descriptions would need rethinking.
13. **SDK line.** Stay on SDK v1 (handshake revisions, security fixes for a limited time) or build geenee on v2 and the 2026-07-28 revision, possibly dual-era?

### Things I could not verify

- Any live Host behaviour. In particular: whether claude.ai and Claude desktop chat pass server `instructions` to the model, defer tool definitions, or honour `list_changed`; and how either Host presents same-named tools from two connectors.
- Whether ChatGPT honours `list_changed`. The pages read mention only manual refresh.
- Which MCP revision each Host currently sends to a custom connector, and whether any Host has stopped sending `Mcp-Session-Id`.
- The current way to add a custom MCP server in ChatGPT and on which plans and surfaces. OpenAI's page describes "ChatGPT Plugins → Add custom MCP server"; igvjs-mcp's notes of 2026-10-12 found it only in Codex mode on desktop. The OpenAI pages were available to me only as tool-generated summaries.
- Whether juicebox-mcp suffers the Claude desktop two-session problem that igvjs-mcp's ADR 0003 fixed. Inferred from the code, not observed.
- Whether the gateway trick of addressing a juicebox room by sending its id as `mcp-session-id` works against a deployed Worker. Read from the code only.
- Which juicebox endpoint real users are connected to, and how `juicebot-mcp.3dg.io` is attached to `juicebox-mcp-v2`.
- The `aidenlab/plugins` repository and the juicebot plugin's contents.
- Whether production `https://aidenlab.org/juicebox/` is built with the room widget. Only the local `weiszd/juicebox-web` checkout was looked at.
- Whether SDK 1.32 accepts zod 3 and zod 4 schemas in one server, and whether SDK v2 runs unchanged on Workers.
- Whether the two Workers are on the same Cloudflare account (igvjs-mcp names its account id and the `3dg.io` zone, `igv:server/wrangler.toml:7-10`; juicebox-mcp's `wrangler.toml` names no account). This matters for Worker-to-Worker calls in option (c).
- Token counts are character counts divided by four, not tokenizer output.
- Test counts are counts of `it(` occurrences, not test-runner output. No test suite was run.

## 7. Leaning (my judgement, not a finding)

- The finding I would weigh most is section 4.3: the server cannot see context, so "contextual exposure" in practice means a static list that the model routes over, helped by a per-viewer name prefix, a routing sentence at the start of each description, and short `instructions`. Option (b1) looks like the literal reading of the brief and is the one the specification and the Hosts support least.
- The room handle looks like the first thing to settle, ahead of naming. igvjs-mcp's `room` argument is what the current specification recommends, and it is the piece that would let one handle span two viewers.
- (c) looks like the fastest route to a single connector and the least intrusive on the juicebox fork, at the price of rewriting upstream text in flight. (a) built on a (d)-style core looks like the cleaner end state, at the price of reconciling two languages, two zod versions and two room models first. They are not exclusive: a gateway could be a throwaway that answers the routing question (do models pick the right viewer among 46 prefixed tools, in each Host?) before the larger merge is committed to.
- That routing question is empirical and nothing I read answers it. A small prototype measuring wrong-viewer calls in Claude desktop and ChatGPT Codex mode would turn the main risk of (a) and (c) from a guess into a number.
- I would treat the tool count as a reason to consolidate overlapping tools during a merge, not as a blocker: 46 is at the edge of Anthropic's stated range, not past a limit.
