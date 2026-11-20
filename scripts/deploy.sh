#!/usr/bin/env bash
# Deploy geenee by hand (there is no CI deploy):
#   scripts/deploy.sh <prod-tag>   to geenee production, the published Connector
#   scripts/deploy-dev.sh [ref]    to geenee dev, a single slot for trying a branch
#
#   prod  Worker geenee      at https://geenee.3dg.io      (wrangler.toml [env.prod])
#   dev   Worker geenee-dev  at https://geenee-dev.3dg.io  (wrangler.toml [env.dev])
#
# geenee production is released only from a prod-YYYY-MM-DD[.N] tag already pushed to origin
# (ADR 0004), so what it runs can always be named; dev takes any branch, tag or commit.
#
# Each forwards to the Upstreams its environment of wrangler.toml names (ADR 0004): prod to the prod
# Upstreams igv-mcp.3dg.io, juicebox-view-mcp.3dg.io and spacewalk-mcp.3dg.io, whose Viewers are
# igv-viewer.pages.dev, juicebox-view.pages.dev and spacewalk-viewer.pages.dev/viewer.html; dev to
# the dev Upstreams igv-mcp-dev.3dg.io, juicebox-view-mcp-dev.3dg.io and spacewalk-mcp-dev.3dg.io,
# whose Viewers are igv-viewer-dev.pages.dev, juicebox-view-dev.pages.dev and
# spacewalk-viewer-dev.pages.dev/viewer.html. geenee only forwards (ADR 0001), so this deploys
# geenee alone: each Upstream is released from its own repository (igvjs-mcp, juicebox-mcp,
# spacewalk-mcp), and all three have to be up for the checks at the end to pass. The run ends by
# printing the version each Upstream reports, the record of what the release was checked against;
# /versions shows the same, asked anew.
#
# geenee is deployed at the ref from a throwaway worktree, so uncommitted changes never ship. One
# Worker holds both halves: the Connector at /mcp and the Workspace page, built from index.html and
# uploaded as the Worker's static assets. A deploy to one never touches the other.
#
# To release prod:
#   git tag prod-2026-11-12 && git push origin prod-2026-11-12 && scripts/deploy.sh prod-2026-11-12
# A second release on the same day is prod-2026-11-12.2, and so on.
#
# First time on a machine, log in first: `npx wrangler login`, with a login that can reach the
# account named in wrangler.toml. The first deploy of each also creates the DNS record for its
# custom domain.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# deploy-dev.sh sets GEENEE_DEPLOYMENT=dev; nothing else should.
DEPLOYMENT="${GEENEE_DEPLOYMENT:-prod}"
# The *_PAGE are the Viewer pages the Workspace of each should frame, as named by the Upstreams in
# that environment of wrangler.toml.
case "$DEPLOYMENT" in
  prod)
    WORKER=geenee     ADDRESS=https://geenee.3dg.io
    IGV_PAGE=https://igv-viewer.pages.dev/
    JUICEBOX_PAGE=https://juicebox-view.pages.dev/
    SPACEWALK_PAGE=https://spacewalk-viewer.pages.dev/viewer.html
    ;;
  dev)
    WORKER=geenee-dev ADDRESS=https://geenee-dev.3dg.io
    IGV_PAGE=https://igv-viewer-dev.pages.dev/
    JUICEBOX_PAGE=https://juicebox-view-dev.pages.dev/
    SPACEWALK_PAGE=https://spacewalk-viewer-dev.pages.dev/viewer.html
    ;;
  *) echo "unknown deployment '$DEPLOYMENT'" >&2; exit 2 ;;
esac

SCRIPT=scripts/deploy.sh
[[ "$DEPLOYMENT" == dev ]] && SCRIPT=scripts/deploy-dev.sh
usage() {
  if [[ "$DEPLOYMENT" == prod ]]; then
    echo "usage: $SCRIPT <prod-YYYY-MM-DD[.N]>"
    echo
    echo "Releases geenee at a prod- tag already pushed to origin to geenee production,"
  else
    echo "usage: $SCRIPT [ref]"
    echo
    echo "Deploys geenee at [ref], a branch, tag or commit (default HEAD), to geenee dev,"
  fi
  echo "$ADDRESS. The Connector is $ADDRESS/mcp."
}
case "${1:-}" in
  -h|--help|-help|--h) usage; exit 0 ;;
  -*) echo "unknown option '$1'" >&2; usage >&2; exit 2 ;;
esac
if (( $# > 1 )); then usage >&2; exit 2; fi
REF="${1:-HEAD}"

# prod runs only a pushed prod- tag (ADR 0004): the tag here must be the tag on origin, so that the
# version it reports names a commit anyone can check out.
if [[ "$DEPLOYMENT" == prod ]]; then
  if [[ ! "$REF" =~ ^prod-[0-9]{4}-[0-9]{2}-[0-9]{2}(\.[0-9]+)?$ ]] || ! git -C "$REPO_ROOT" rev-parse -q --verify "refs/tags/$REF" >/dev/null; then
    echo "geenee production is released only from a pushed prod-YYYY-MM-DD[.N] tag, not '$REF'" >&2
    echo "  git tag prod-$(date +%Y-%m-%d) && git push origin prod-$(date +%Y-%m-%d)" >&2
    echo "  $SCRIPT prod-$(date +%Y-%m-%d)" >&2
    exit 2
  fi
  pushed="$(git -C "$REPO_ROOT" ls-remote --tags origin "refs/tags/$REF" | cut -f1)"
  if [[ "$pushed" != "$(git -C "$REPO_ROOT" rev-parse "refs/tags/$REF")" ]]; then
    echo "$REF is not on origin: push it first (git push origin $REF)" >&2
    exit 2
  fi
fi

# Every run ends by naming the Connector URL, whether it deployed or not, so it can be copied into a Host.
WORK=""
finish() {
  status=$?
  if [[ -n "$WORK" ]]; then
    git -C "$REPO_ROOT" worktree remove --force "$WORK/geenee" 2>/dev/null || true
    rm -rf "$WORK"
  fi
  echo
  if (( status == 0 )); then echo "Connector URL: $ADDRESS/mcp"; else echo "Connector URL: $ADDRESS/mcp (this run failed; see above)"; fi
}
trap finish EXIT

(cd "$REPO_ROOT" && npx wrangler whoami >/dev/null 2>&1) || { echo "not logged in to Cloudflare: run 'npx wrangler login' first" >&2; exit 1; }

WORK="$(mktemp -d)"

git -C "$REPO_ROOT" worktree add -q --detach "$WORK/geenee" "$REF"
echo "geenee $(git -C "$WORK/geenee" rev-parse --short HEAD) at $REF to $DEPLOYMENT"
cd "$WORK/geenee"
# The ref is built with its own wrangler.toml, so it must name this Worker for this deployment. An
# older ref may not have a prod environment, or may have dev as an older Worker.
named="$(awk -v section="[env.$DEPLOYMENT]" '$0 == section { inside = 1; next } /^\[/ { inside = 0 } inside && $1 == "name" { gsub(/"/, "", $3); print $3; exit }' wrangler.toml)"
if [[ "$named" != "$WORKER" ]]; then
  echo "$REF's wrangler.toml gives [env.$DEPLOYMENT] the Worker '${named:-none}', not $WORKER: merge main into it first" >&2
  exit 1
fi
npm ci --no-audit --no-fund --loglevel=error
npm run typecheck
npm run test:run
# deploy:<env> in package.json builds that environment of wrangler.toml (CLOUDFLARE_ENV), and
# `wrangler deploy` then deploys what was built. The worktree is detached, so the version
# (scripts/version.sh) takes its tag or branch from GEENEE_REF.
# HEAD names the branch checked out here, if there is one.
GEENEE_REF="$REF"
[[ "$REF" == HEAD ]] && GEENEE_REF="$(git -C "$REPO_ROOT" symbolic-ref --short -q HEAD || echo HEAD)"
export GEENEE_REF
version="$(scripts/version.sh)"
npm run "deploy:$DEPLOYMENT"

# The version each Upstream reports, as the record of what this release was checked against: an
# Upstream is reached by its address, not pinned, so it can be released again without geenee.
# Printed before the checks, so that it is there when one of them fails.
echo "the Upstreams behind it (see $ADDRESS/versions):"
upstreams="$(awk -v section="[env.$DEPLOYMENT.vars]" '$0 == section { inside = 1; next } /^\[/ { inside = 0 } inside && $1 ~ /_UPSTREAM_URL$/ { gsub(/"/, "", $3); print $3 }' wrangler.toml)"
for upstream in $upstreams; do
  reported="$(curl -fsS -m 10 -X POST "$upstream" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
    -d '{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"geenee-deploy","version":"0"}}}' \
    | sed -n 's/.*"serverInfo":{[^}]*"version":"\([^"]*\)".*/\1/p')" || true
  printf '  %-44s %s\n' "$upstream" "${reported:-did not answer}"
done

mcp() {
  curl -fsS -X POST "$ADDRESS/mcp" \
    -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d "$1"
}

# The deployed Connector should be this build: it gives its tag or branch and commit as its version.
live_version="$(mcp '{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"deploy-test","version":"0"}}}' \
  | sed -n 's/.*"serverInfo":{[^}]*"version":"\([^"]*\)".*/\1/p')"
if [[ "$live_version" != "$version" ]]; then
  echo "the Connector at $ADDRESS/mcp is not this build, $version: it gives its version as '$live_version'" >&2
  exit 1
fi

# The deployed Connector should list open_geenee and the tools of every Upstream.
listed="$(mcp '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | grep -o '"name":"[A-Za-z0-9_.-]*"' | wc -l | tr -d ' ')"

# And the Workspace should frame each Viewer page: each Upstream gives its page's address in the
# Join link. A Room geenee never opened is as good as expired (ADR 0003), so open_geenee opens one
# first.
room="$(mcp '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"open_geenee","arguments":{}}}' \
  | grep -o '"room":"[0-9A-Z]*"' | head -1 | cut -d'"' -f4)"
viewers="$(curl -fsS "$ADDRESS/viewers?room=$room")"
frames() { # <key in /viewers> <Viewer name> <page>
  if [[ "$viewers" != *"\"$1\":\"$3"* ]]; then
    echo "the Workspace at $ADDRESS does not frame $3 for $2: /viewers answered $viewers" >&2
    exit 1
  fi
}
frames igv igv "$IGV_PAGE"
frames juicebox Juicebox "$JUICEBOX_PAGE"
frames spacewalk Spacewalk "$SPACEWALK_PAGE"

echo "deployed $version to $DEPLOYMENT at $ADDRESS: the Connector lists $listed tools; its Viewers are $IGV_PAGE, $JUICEBOX_PAGE and $SPACEWALK_PAGE"
