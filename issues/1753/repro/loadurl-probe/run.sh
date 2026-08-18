#!/usr/bin/env bash
# usage: BB_REPO=/abs/path/to/bb ./run.sh [url]
# Prerequisites: Linux with xvfb-run; electron from apps/desktop/node_modules (pnpm install).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
electron="$BB_REPO/apps/desktop/node_modules/electron/dist/electron"
unset ELECTRON_RUN_AS_NODE
xvfb-run -a -s "-screen 0 1024x768x24" "$electron" --no-sandbox --disable-gpu "$here/main.cjs" "${1:-http://old-host.tailnet.ts.net:38886/}" 2>/dev/null
