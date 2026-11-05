#!/usr/bin/env bash
# Print the version of the checkout, which geenee reports as its own: the tag or branch it was
# built from and its short commit, as `prod-2026-11-12 (a1b2c3d)` on prod and `main (d4e5f6a)` on
# dev, with -dirty after the commit when tracked files have uncommitted changes. Both are read from
# git, so nothing is bumped by hand.
#
# The deploy:* scripts in package.json build with it as VITE_VERSION; the Connector gives it as its
# MCP serverInfo.version and the Workspace shows it. `npm run dev` has none.
#
# The name is GEENEE_REF when that is a tag or branch: scripts/deploy.sh builds in a detached
# worktree and sets it to the ref it was given. Otherwise it is the tag at the commit, else the
# branch checked out, else "detached".
set -euo pipefail
ref="${GEENEE_REF:-}"
if [[ -n "$ref" && "$(git rev-parse --symbolic-full-name "$ref" 2>/dev/null)" == refs/* ]]; then
  name="$ref"
else
  name="$(git describe --tags --exact-match HEAD 2>/dev/null || git symbolic-ref --short -q HEAD || echo detached)"
fi
dirty=""
git diff --quiet HEAD || dirty="-dirty"
echo "$name ($(git rev-parse --short HEAD)$dirty)"
