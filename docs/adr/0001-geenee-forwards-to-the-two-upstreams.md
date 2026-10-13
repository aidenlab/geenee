# geenee forwards tool calls to the two deployed Upstreams

geenee is one Connector for both igv.js and Juicebox, but it contains neither tool set. It asks the two deployed Upstreams (`igv-bot-mcp-dev` and `juicebot-mcp-dev`) for their tools, serves the combined list under names that say which Viewer a tool drives (`igv_zoom_in`, `juicebox_zoom_in`), and passes each call to the Upstream that owns it. This was chosen because geenee is a proof of concept that one installation makes sense, and forwarding gets there without changing either Upstream.

## Considered Options

- **Copy both servers' code into geenee.** Rejected for now: `igvjs-mcp` is TypeScript on zod 4 and `juicebox-mcp` is JavaScript on zod 3, and they find a Viewer's Room in different ways. Reconciling them is real work that says nothing about whether the idea is sound. Forwarding does not rule it out later.
- **Change the tool list with the conversation**, offering only the igv tools or only the Juicebox tools at a time. Rejected: a server cannot see the conversation, the MCP specification (2026-07-28) says the tool list must not vary per connection, and neither Upstream can announce a changed list. The model chooses a tool from its name and description, which a fixed combined list already allows.

## Consequences

- The names geenee serves are its own contract. Descriptions and replies from an Upstream name its tools by their original names, so geenee rewrites those names in the text it passes on.
- geenee hides each Upstream's own "open" tool and Juicebox's `join_room`, and adds `open_geenee`, so that a Viewer is only ever opened inside the Workspace (ADR 0002).
- Every tool takes one Room id from the model, including Juicebox tools whose Upstream versions take none. geenee uses it to tell each Upstream which Room a call is for. This gives the Juicebox tools the protection `igvjs-mcp` added in its ADR 0003, for a Host that moves a conversation to another MCP session.
- geenee is only as available as its Upstreams. When one cannot be reached, the other's tools are still served.
- Each Upstream stays a working Connector in its own right, and a change to its tools appears in geenee without a geenee release.
