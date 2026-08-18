#!/usr/bin/env bash
# Turn the connect plugin back on on the dev instance (used after the 503 probe).
set -euo pipefail
cd "$BB_REPO"
BB_SERVER_URL="${BB_SERVER_URL:-http://localhost:23801}" pnpm bb:dev plugin enable connect
