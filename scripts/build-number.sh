#!/usr/bin/env bash
# Print the build number of the checkout: its commit count, short hash and the time of the build, as
# `42 (793af76, 2026-10-20 14:58 EDT)`, with -dirty after the hash when tracked files have uncommitted
# changes. The count and hash say which code it is; the time says which deploy. The deploy:* scripts in
# package.json build with it as VITE_BUILD; the Connector gives it as its version and the Workspace
# shows it. `npm run dev` has none.
set -euo pipefail
dirty=""
git diff --quiet HEAD || dirty="-dirty"
echo "$(git rev-list --count HEAD) ($(git rev-parse --short HEAD)$dirty, $(date '+%Y-%m-%d %H:%M %Z'))"
