#!/usr/bin/env bash
# Deploy geenee to geenee test, https://geenee-test.3dg.io, a single slot for trying a branch
# without touching the published Connector:
#   scripts/deploy-test.sh [ref]
# Whichever ref was deployed last is what it runs. See scripts/deploy.sh.
set -euo pipefail
GEENEE_DEPLOYMENT=test exec "$(dirname "${BASH_SOURCE[0]}")/deploy.sh" "$@"
