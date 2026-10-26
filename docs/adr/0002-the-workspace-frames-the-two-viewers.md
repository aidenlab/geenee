# The Workspace frames the two existing Viewers

A Host shows one web page beside the conversation, and a Connector cannot swap that page for another: it can only hand over a link to open. Two separately opened Viewers would leave the swapping to the model or the person, and a Viewer that has been navigated away from can no longer receive commands. So geenee has one page of its own, the Workspace, which the Host opens once. It holds the igv Viewer and the Juicebox Viewer, each in a frame, loads both when it opens, and shows one at a time.

The Workspace brings forward the Viewer the model last sent a command to; a person can pick the other with a tab. Each tab carries a mark showing whether its Viewer is connected.

## Considered Options

- **Two pages, one per Viewer**, as the Upstreams have today. Rejected for the reason above.
- **One built page containing igv.js and juicebox.js directly.** A tighter result, with one layout and shared controls. Rejected for the proof of concept: it means reusing each Upstream's page-side code and having both servers accept connections from the geenee page, which changes both Upstreams. It is the natural next step if the Workspace proves the idea.

## Consequences

- Each Viewer is still served from its own address and talks to its own Upstream exactly as before, so neither Upstream changes.
- geenee needs a channel of its own to the Workspace, to say which Viewer was just used. geenee is therefore a server and a page, not only a forwarder.
- The Workspace depends on both Viewer pages allowing themselves to be framed, and on each Host's pane showing a page that frames other sites. Neither is a documented contract; both dev Viewers allowed framing when checked on 2026-10-13.
- Loading both Viewers at once makes the first open slower.
- The Workspace adds `embedded` to each frame's Join link, so that a Viewer can leave out what the Workspace supplies, starting with the igv Shareable URL. The Join links geenee keeps and hands out stay unmarked.
