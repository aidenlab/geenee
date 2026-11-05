# Deployments rollout: ticket punchlist

The tickets that give geenee and each Upstream two Deployments, prod and dev. Tracked in [geenee#60](https://github.com/aidenlab/geenee/issues/60); the decision is [ADR 0004](adr/0004-two-deployments-not-versioned-urls.md), the target is [deployments.html](deployments.html).

Work top to bottom. A ticket can start once everything in its **After** column is done. geenee prod keeps working on the dev Upstreams until step 4.

## Before starting

- [ ] Tell David Weisz about juicebox-mcp #20 and #21 (Juicebot production is not touched)

## 1. Versions

Each Deployment reports `tag (sha)` on prod, `branch (sha)` on dev. All four can be done at once.

| Done | Ticket | What | After |
|:-:|---|---|---|
| [ ] | [geenee#61](https://github.com/aidenlab/geenee/issues/61) | geenee reports tag or branch and commit | — |
| [ ] | [igvjs-mcp#48](https://github.com/aidenlab/igvjs-mcp/issues/48) | igv reports tag or branch and commit | — |
| [ ] | [juicebox-mcp#19](https://github.com/aidenlab/juicebox-mcp/issues/19) | Juicebox reports tag or branch and commit | — |
| [ ] | [spacewalk-mcp#59](https://github.com/aidenlab/spacewalk-mcp/issues/59) | Spacewalk reports tag or branch and commit | — |

## 2. dev renames

| Done | Ticket | What | After |
|:-:|---|---|---|
| [ ] | [igvjs-mcp#49](https://github.com/aidenlab/igvjs-mcp/issues/49) | New dev at `igv-mcp-dev` / `igv-viewer-dev`; no custom domain; close #15 | — |
| [ ] | [juicebox-mcp#20](https://github.com/aidenlab/juicebox-mcp/issues/20) | New dev at `juicebox-view-mcp-dev` / `juicebox-view-dev` | — |
| [ ] | [geenee#62](https://github.com/aidenlab/geenee/issues/62) | geenee dev and prod forward to the new dev names; delete the old igv and Juicebox dev Deployments ⚠ | igvjs-mcp#49, juicebox-mcp#20 |

## 3. prod Upstreams

| Done | Ticket | What | After |
|:-:|---|---|---|
| [ ] | [igvjs-mcp#50](https://github.com/aidenlab/igvjs-mcp/issues/50) | Create igv prod, `igv-mcp` / `igv-viewer`; first `prod-` release ⚠ | igvjs-mcp#48, #49 |
| [ ] | [juicebox-mcp#21](https://github.com/aidenlab/juicebox-mcp/issues/21) | Create geenee's Juicebox prod, `juicebox-view-mcp` / `juicebox-view`; first `view-prod-` release ⚠ | juicebox-mcp#19, #20 |
| [ ] | [spacewalk-mcp#60](https://github.com/aidenlab/spacewalk-mcp/issues/60) | First Spacewalk prod release, `spacewalk-mcp` / `spacewalk-viewer` ⚠ | spacewalk-mcp#59 |

## 4. geenee cutover

| Done | Ticket | What | After |
|:-:|---|---|---|
| [ ] | [geenee#63](https://github.com/aidenlab/geenee/issues/63) | geenee prod forwards to the prod Upstreams; tag-only releases; `/versions`; update the deploy docs ⚠ | geenee#61, #62, igvjs-mcp#50, juicebox-mcp#21, spacewalk-mcp#60 |

## Finally

- [ ] Close [geenee#60](https://github.com/aidenlab/geenee/issues/60)

⚠ changes something live on Cloudflare (a prod release, a new secret, or a deletion): worth watching as it runs.
