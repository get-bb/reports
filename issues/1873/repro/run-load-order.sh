#!/bin/bash
# Regenerates daemon-bundle-addon-load-order.log: runs the built daemon bundle with
# a preload that logs every process.dlopen, NODE_PATH unset.
# Usage: run-load-order.sh <repo-root> [output-log-name]
set -u
unset NODE_PATH
repo="${1:?repo root}"
name="${2:-daemon-bundle-addon-load-order.log}"
here="$(cd "$(dirname "$0")" && pwd)"
cd "$repo/apps/host-daemon" || exit 2
cp "$here/log-dlopen.cjs" ./log-dlopen.cjs
node --require ./log-dlopen.cjs dist/daemon-bundle.mjs --definitely-not-a-flag 2>&1 \
  | grep -E '^\[dlopen|^\[exit' | sed "s#$repo#<repo>#g" > "$here/$name"
cat "$here/$name"
