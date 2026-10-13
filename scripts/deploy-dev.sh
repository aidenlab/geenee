#!/usr/bin/env bash
# Deploy "geenee dev" by hand (there is no CI deploy):
#
#   Worker  geenee-dev  at https://geenee-dev.3dg.io   (wrangler.toml [env.dev])
#
# One Worker holds both halves: the Connector at /mcp and the Workspace page,
# which is built from index.html and uploaded as the Worker's static assets.
#
#   scripts/deploy-dev.sh
#
# First time on a machine, log in first: `npx wrangler login`, with a login that
# can reach the account named in wrangler.toml. The first deploy also creates
# the DNS record for the custom domain.
#
# The build is told which environment of wrangler.toml to build by
# CLOUDFLARE_ENV, and `wrangler deploy` then deploys what was built, so the
# environment is named once, in the deploy:dev script of package.json.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADDRESS="https://geenee-dev.3dg.io"
cd "$REPO_ROOT"

npx wrangler whoami >/dev/null 2>&1 || { echo "not logged in to Cloudflare: run 'npx wrangler login' first" >&2; exit 1; }

npm run typecheck
npm run test:run
npm run deploy:dev

# The deployed Connector should list open_geenee and the tools of both Upstreams.
listed="$(curl -fsS -X POST "$ADDRESS/mcp" \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | grep -o '"name":"[A-Za-z0-9_.-]*"' | wc -l | tr -d ' ')"
echo "deployed to $ADDRESS: the Connector is $ADDRESS/mcp and lists $listed tools (44 with both Upstreams reachable)"
