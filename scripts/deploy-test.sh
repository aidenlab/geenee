#!/usr/bin/env bash
# Deploy geenee by hand to one of its two dev deployments, one for each Juicebot dev stack of
# juicebox-mcp (there is no CI deploy):
#   scripts/deploy-test.sh <web|view> [ref]
#
#   web   Worker geenee-dev       at https://geenee-dev.3dg.io       (wrangler.toml [env.dev]),
#         Juicebox Upstream juicebot-mcp-dev.3dg.io, Viewer the juicebox-web page juicebot-dev.3dg.io
#   view  Worker geenee-view-dev  at https://geenee-view-dev.3dg.io  (wrangler.toml [env.view-dev]),
#         Juicebox Upstream juicebot-view-mcp-dev.3dg.io, Viewer the juicebox-view page
#         juicebot-view-dev.pages.dev
#
# Both use the igv Upstream igv-bot-mcp-dev.3dg.io. geenee only forwards (ADR 0001), so this
# deploys geenee alone: the Juicebox stack it names is deployed from juicebox-mcp, with its
# scripts/deploy-test.sh, and has to be up for the checks at the end to pass.
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

USAGE="usage: scripts/deploy-test.sh <web|view> [ref]"
STACK="${1:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
case "$STACK" in
  web)
    WRANGLER_ENV=dev
    ADDRESS=https://geenee-dev.3dg.io
    JUICEBOX_PAGE=https://juicebot-dev.3dg.io/ ;;
  view)
    WRANGLER_ENV=view-dev
    ADDRESS=https://geenee-view-dev.3dg.io
    JUICEBOX_PAGE=https://juicebot-view-dev.pages.dev/ ;;
  *)
    echo "$USAGE" >&2; exit 2 ;;
esac
REF="${2:-HEAD}"

(cd "$REPO_ROOT" && npx wrangler whoami >/dev/null 2>&1) || { echo "not logged in to Cloudflare: run 'npx wrangler login' first" >&2; exit 1; }

WORK="$(mktemp -d)"
cleanup() {
  git -C "$REPO_ROOT" worktree remove --force "$WORK/geenee" 2>/dev/null || true
  rm -rf "$WORK"
}
trap cleanup EXIT

git -C "$REPO_ROOT" worktree add -q --detach "$WORK/geenee" "$REF"
echo "geenee $(git -C "$WORK/geenee" rev-parse --short HEAD) at $REF to $STACK"
cd "$WORK/geenee"
npm ci --no-audit --no-fund --loglevel=error
npm run typecheck
npm run test:run
# deploy:<env> in package.json builds that environment of wrangler.toml (CLOUDFLARE_ENV), and
# `wrangler deploy` then deploys what was built.
npm run "deploy:$WRANGLER_ENV"

mcp() {
  curl -fsS -X POST "$ADDRESS/mcp" \
    -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d "$1"
}

# The deployed Connector should list open_geenee and the tools of both Upstreams.
listed="$(mcp '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | grep -o '"name":"[A-Za-z0-9_.-]*"' | wc -l | tr -d ' ')"

# And the Workspace should frame this stack's Juicebox page: the Upstream gives its page's
# address in the Join link, for any Room.
viewers="$(curl -fsS "$ADDRESS/viewers?room=0000000000")"
if [[ "$viewers" != *"\"juicebox\":\"$JUICEBOX_PAGE"* ]]; then
  echo "the Workspace at $ADDRESS does not frame $JUICEBOX_PAGE for Juicebox: /viewers answered $viewers" >&2
  exit 1
fi

echo "deployed $STACK to $ADDRESS: the Connector is $ADDRESS/mcp and lists $listed tools (44 with both Upstreams reachable); its Juicebox Viewer is $JUICEBOX_PAGE"
