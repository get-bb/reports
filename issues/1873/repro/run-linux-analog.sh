#!/bin/bash
# Runs the Linux analog (napi-wrapper-coalesce-linux.cjs) from apps/host-daemon
# with NODE_PATH deliberately unset, so the module resolution inside the script
# is exactly what a fresh clone gets. Usage: run-linux-analog.sh <repo-root>
set -u
unset NODE_PATH
repo="${1:?repo root}"
out="$(cd "$(dirname "$0")" && pwd)"
cd "$repo/apps/host-daemon" || exit 2
cp "$out/napi-wrapper-coalesce-linux.cjs" ./napi-wrapper-coalesce-linux.cjs
echo "NODE_PATH=${NODE_PATH:-<unset>}"
{ node napi-wrapper-coalesce-linux.cjs --local; echo "exit=$?"; } > "$out/linux-rtld-local.log" 2>&1
{ node napi-wrapper-coalesce-linux.cjs; echo "exit=$?"; } > "$out/linux-rtld-global.log" 2>&1
echo "--- linux-rtld-local.log"; cat "$out/linux-rtld-local.log"
echo "--- linux-rtld-global.log"; cat "$out/linux-rtld-global.log"
