# /install redirects to the Marketplace install page

`/install` is geenee's stable install address and redirects to the Marketplace install page in aidenlab/plugins. geenee shows no install steps of its own.

geenee is installed only through the Marketplace (ADR 0001 in aidenlab/plugins), and the steps for every Host live on one page in that repository, next to the Plugin they install. What geenee owns is the address people are given: `geenee.3dg.io/install` is the one printed in the paper and on slides, pasted into a Zoom chat and passed on by word of mouth. It answers with a 302, on both Deployments, so the install page can move or change without that address changing. `/get`, the address of geenee's old custom-connector page, redirects there too, because Hand-off emails already sent contain it.

Installing and joining a Room are two different jobs. The Card's QR code and the Hand-off invite more Participants into a live Room, and are unchanged. The Hand-off's secondary "Get geenee" link, its email, the expired-Room page and a quiet line in a Workspace opened by Room link are how someone on that path reaches installation. The install address has nothing to do with Rooms and has no QR code.

## Considered Options

- **Keep geenee's own install page at `/get`**, teaching the custom-connector route. Rejected: that route is no longer offered, as a custom connector gets no updates, and a second copy of the install steps would drift from the Marketplace's.
- **Link straight to the plugins install page** from geenee's pages. Rejected: the address would be the plugins repository's to change, and it is not the one people are given.
- **An `install_geenee` tool, or install steps on the Card.** Rejected: a tool exists only after geenee is connected, and only connected people see the Card.

## Consequences

- The Hand-off and the Room lose the switch between them and Get geenee. A Guest goes back with the browser's back button.
- Moving the install page means changing one constant, `INSTALL_PAGE` in `src/page.ts`, and deploying both Deployments.
