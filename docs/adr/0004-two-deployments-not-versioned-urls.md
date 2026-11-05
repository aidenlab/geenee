# Two Deployments, prod and dev, not versioned URLs

geenee reaches each Upstream by a URL, so nothing in geenee says which build of an Upstream it is using, and an Upstream can change under geenee without geenee being deployed. We keep that, and make it safe by giving geenee and every Upstream exactly two Deployments, prod and dev, each at an address that never changes: geenee prod forwards only to the prod Upstreams and geenee dev only to the dev ones. A prod Deployment changes only when someone releases a tag to it. Every Deployment reports what it runs as its version, its tag or branch and its commit, and geenee shows the versions of the Upstreams behind it, so the build behind any address can always be read even though it is never pinned.

## Considered Options

- **Versioned URLs**, a version in each Upstream's address that geenee pins (`/v1/mcp`, or one address per build). Rejected for now: geenee is the only consumer of the Upstreams' prod Deployments and is changed by the same people, so a breaking change can be made in step on both sides. Versioned addresses would mean keeping old builds running for a consumer that never needs them.
- **Sharing Juicebot production** (`juicebot-mcp.3dg.io`, `juicebot.3dg.io`) as the Juicebox Upstream's prod. It runs the same code, but it has its own releases and its own users, and two people release it. Rejected: geenee gets its own Juicebox prod Deployment, released from `view-prod-` tags, and Juicebot production is never touched by geenee's work.
- **Promoting the built artifact** (Worker versions, Pages promotion) instead of rebuilding the tagged commit. Rejected as more machinery than a project this size needs.

## Consequences

- The names say what each thing is: `<upstream>-mcp[-dev].3dg.io` for an Upstream's Worker and `<upstream>-viewer[-dev].pages.dev` for its Viewer; for Juicebox, whose Viewer is juicebox-view, `juicebox-view-mcp` and `juicebox-view`. Viewers have no custom domains.
- A Worker and its Viewer are released together from one tag, so one version covers both.
- Prod is released only from a tag, in all four repositories, so a prod Deployment can always name what it runs.
- Revisit this when the Upstreams' prod Deployments get a consumer other than geenee, or when a breaking change needs two versions of an Upstream live at once. Either is the point to bring in versioned URLs.
