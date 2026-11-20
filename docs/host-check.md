# The Host check

The same short script of requests, run in every Host on geenee dev before prod changes. Each request has an expected result and gets a pass or a fail in each Host. **A failure stops the release.**

It is run before every prod release of geenee (`scripts/deploy.sh`, which asks whether it passed) and of the geenee Plugin (aidenlab/plugins, `docs/maintaining.md`). Words such as Host, Card, Room link and QR address are defined in [`GLOSSARY.md`](../GLOSSARY.md).

## Before you start

1. Deploy what is to be released to dev: the commit of the `prod-` tag, or for a Plugin release the geenee that is live on prod.

   ```sh
   scripts/deploy-dev.sh prod-2026-11-12
   ```

2. In each Host, point the geenee Connector at dev, `https://geenee-dev.3dg.io/mcp`. For a Plugin release, install the Plugin at the version to be released.
3. Watch the Worker's log while you go. Every request names its Host there, and the `initialize` line shows whether the Host declares MCP Apps, so that it can draw the Card:

   ```sh
   npx wrangler tail --env dev
   ```

   ```
   [host] initialize | claude-ai 0.1.0 | MCP Apps: yes | User-Agent: …
   [host] tools/call | User-Agent: …
   ```

4. Start a **new conversation** in each Host, so that it reads geenee's tools and instructions afresh.

## The script

Send each request, word for word, in the same conversation, in this order.

| # | Request | Expected result |
| - | ------- | --------------- |
| 1 | `hello geenee` | The Workspace link, the Room link, the Room id and the QR code of the Room link are shown, in the Card or in the reply. The QR code scans to the Room link. |
| 2 | `share geenee` | The same Room's link, id and QR code are shown again. No new Room: the Room id is the one from request 1. |
| 3 | `open myc in igv` | The igv Viewer, in the Workspace from request 1, shows MYC. |
| 4 | `list the geenee tools you can call` | Evidence, not a pass or fail: write down whether `open_geenee` and `share_geenee` are listed. |

In a terminal Host (Claude Code, Codex CLI), no Card can be drawn: requests 1 and 2 pass with the Room link and a usable QR code, an address that opens the picture (the QR address, `…/r/<Room id>/qr.png`), and nothing more. For request 3, open the Room link in a browser first.

## Results

Copy this table into the pull request or issue for the release, and fill in one column per Host: **pass** or **fail** for requests 1 to 3, what was listed for request 4, and the Host's name and MCP Apps line from the log.

| # | Claude desktop | claude.ai | ChatGPT desktop, Codex mode | Claude Code | Codex CLI |
| - | -------------- | --------- | --------------------------- | ----------- | --------- |
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| Log | | | | | |

Commit on dev: `       ` · Date: `          ` · Run by: `          `

Every cell of requests 1 to 3 must read pass. If one fails, fix it, deploy the fix to dev and run the whole script again in every Host.
