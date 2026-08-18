#!/usr/bin/env bash
# usage: BB_REPO=/abs/path/to/bb ./build.sh
# Bundles the real apps/desktop/src/menu.ts (unmodified) next to main.cjs.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
cd "$BB_REPO/apps/desktop"
pnpm exec esbuild src/menu.ts --bundle --platform=node --format=cjs --external:electron --outfile="$here/menu.bundle.js"
