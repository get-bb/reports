#!/usr/bin/env bash
# usage: BB_REPO=/abs/path/to/bb ./run.sh <out.png> [main|prototype]
# Runs Electron (from apps/desktop/node_modules) headless under Xvfb, opens the
# Window > Server submenu built by the real menu.ts and saves a screenshot.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
electron="$BB_REPO/apps/desktop/node_modules/electron/dist/electron"
unset ELECTRON_RUN_AS_NODE
xvfb-run -a -s "-screen 0 1024x768x24" "$electron" --no-sandbox --disable-gpu "$here/main.cjs" "$1" "${2:-main}"
