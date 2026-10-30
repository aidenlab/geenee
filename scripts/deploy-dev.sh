#!/usr/bin/env bash
# Deploy geenee to geenee dev, https://geenee-dev.3dg.io, a single slot for trying a branch
# without touching the published Connector:
#   scripts/deploy-dev.sh [ref]
# Whichever ref was deployed last is what it runs. See scripts/deploy.sh.
set -euo pipefail
GEENEE_DEPLOYMENT=dev exec "$(dirname "${BASH_SOURCE[0]}")/deploy.sh" "$@"
