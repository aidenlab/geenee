#!/usr/bin/env bash
# Deploy geenee by hand (there is no CI deploy):
#   scripts/deploy.sh [ref]        to geenee dev, the published Connector
#   scripts/deploy-test.sh [ref]   to geenee test, a single slot for trying a branch
#
#   dev   Worker geenee-view-dev  at https://geenee-view-dev.3dg.io  (wrangler.toml [env.dev])
#   test  Worker geenee-test      at https://geenee-test.3dg.io      (wrangler.toml [env.test])
#
# Both forward to the igv Upstream igv-bot-mcp-dev.3dg.io and the Juicebox Upstream
# juicebot-view-mcp-dev.3dg.io, whose Viewer is the juicebox-view page juicebot-view-dev.pages.dev.
# geenee only forwards (ADR 0001), so this deploys geenee alone: the Juicebox stack is deployed
# from juicebox-mcp, with its scripts/deploy-test.sh, and has to be up for the checks at the end
# to pass.
#
# geenee is deployed at [ref] (default HEAD) from a throwaway worktree, so uncommitted changes
# never ship. One Worker holds both halves: the Connector at /mcp and the Workspace page, built
# from index.html and uploaded as the Worker's static assets. A deploy to one never touches the
# other.
#
# First time on a machine, log in first: `npx wrangler login`, with a login that can reach the
# account named in wrangler.toml. The first deploy of each also creates the DNS record for its
# custom domain.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# deploy-test.sh sets GEENEE_DEPLOYMENT=test; nothing else should.
DEPLOYMENT="${GEENEE_DEPLOYMENT:-dev}"
case "$DEPLOYMENT" in
  dev)  WORKER=geenee-view-dev ADDRESS=https://geenee-view-dev.3dg.io ;;
  test) WORKER=geenee-test      ADDRESS=https://geenee-test.3dg.io ;;
  *)    echo "unknown deployment '$DEPLOYMENT'" >&2; exit 2 ;;
esac
JUICEBOX_PAGE=https://juicebot-view-dev.pages.dev/

SCRIPT=scripts/deploy.sh
[[ "$DEPLOYMENT" == test ]] && SCRIPT=scripts/deploy-test.sh
usage() {
  echo "usage: $SCRIPT [ref]"
  echo
  echo "Deploys geenee at [ref], a branch, tag or commit (default HEAD), to geenee $DEPLOYMENT,"
  echo "$ADDRESS. The Connector is $ADDRESS/mcp."
}
case "${1:-}" in
  -h|--help|-help|--h) usage; exit 0 ;;
  -*) echo "unknown option '$1'" >&2; usage >&2; exit 2 ;;
esac
if (( $# > 1 )); then usage >&2; exit 2; fi
REF="${1:-HEAD}"

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
# older ref may not have a test environment, or may have dev as the retired juicebox-web Worker.
named="$(awk -v section="[env.$DEPLOYMENT]" '$0 == section { inside = 1; next } /^\[/ { inside = 0 } inside && $1 == "name" { gsub(/"/, "", $3); print $3; exit }' wrangler.toml)"
if [[ "$named" != "$WORKER" ]]; then
  echo "$REF's wrangler.toml gives [env.$DEPLOYMENT] the Worker '${named:-none}', not $WORKER: merge main into it first" >&2
  exit 1
fi
npm ci --no-audit --no-fund --loglevel=error
npm run typecheck
npm run test:run
# deploy:<env> in package.json builds that environment of wrangler.toml (CLOUDFLARE_ENV), and
# `wrangler deploy` then deploys what was built.
npm run "deploy:$DEPLOYMENT"

mcp() {
  curl -fsS -X POST "$ADDRESS/mcp" \
    -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d "$1"
}

# The deployed Connector should be this build: it gives its build number as its version.
build="$(mcp '{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"deploy-test","version":"0"}}}' \
  | sed -n 's/.*"serverInfo":{[^}]*"version":"\([^"]*\)".*/\1/p')"
if [[ "$build" != *"($(git rev-parse --short HEAD),"* ]]; then
  echo "the Connector at $ADDRESS/mcp is not this build: it gives its version as '$build'" >&2
  exit 1
fi

# The deployed Connector should list open_geenee and the tools of both Upstreams.
listed="$(mcp '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | grep -o '"name":"[A-Za-z0-9_.-]*"' | wc -l | tr -d ' ')"

# And the Workspace should frame the juicebox-view page: the Upstream gives its page's
# address in the Join link. A Room geenee never opened is as good as expired (ADR 0003),
# so open_geenee opens one first.
room="$(mcp '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"open_geenee","arguments":{}}}' \
  | grep -o '"room":"[0-9A-Z]*"' | head -1 | cut -d'"' -f4)"
viewers="$(curl -fsS "$ADDRESS/viewers?room=$room")"
if [[ "$viewers" != *"\"juicebox\":\"$JUICEBOX_PAGE"* ]]; then
  echo "the Workspace at $ADDRESS does not frame $JUICEBOX_PAGE for Juicebox: /viewers answered $viewers" >&2
  exit 1
fi

echo "deployed build $build to $DEPLOYMENT at $ADDRESS: the Connector lists $listed tools (44 with both Upstreams reachable); its Juicebox Viewer is $JUICEBOX_PAGE"
