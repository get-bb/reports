#!/usr/bin/env bash
# Step 7 of the report: patch ONLY the 3 lookbehind literals + the folded envFlags in the
# served chunks, restart the packaged app, load it on the Safari-16.0-era engine, then
# restore everything. Uses the harness env (BB1603_HARNESS / PLAYWRIGHT_BROWSERS_PATH).
# Usage: bash step7-counter-experiment.sh <bb repo root> [outPrefix=/tmp/bb-reports/issues/1603/fresh-harness/wk160-patched]
set -e
REPO=${1:?bb repo root}
OUTP=${2:-/tmp/bb-reports/issues/1603/fresh-harness/wk160-patched}
R=/tmp/bb-reports/issues/1603/repro
A=$REPO/packages/bb-app/app/dist/assets
PRE=/tmp/bb-1603-precomp-aside
mkdir -p "$PRE" "$(dirname "$OUTP")"
# bb-app prefers the precompressed .br/.gz siblings: move them aside for the two chunks
mv "$A"/workspace-checkout-display-*.js.br "$A"/workspace-checkout-display-*.js.gz "$A"/worker-portable-*.js.br "$A"/worker-portable-*.js.gz "$PRE"/ 2>/dev/null || true
node "$R/patch-lookbehind-experiment.mjs" "$A" --unfold
# restart the app so it re-reads the assets
kill "$(cat "$R/prod-app.pid")" 2>/dev/null || true; sleep 3
bash "$R/start-prod-app.sh" "$REPO"
bash "$R/run-old-webkit160.sh" "$R/wk-load-and-wait.mjs" http://localhost:45031/ "$OUTP" 15000 | cut -c1-400 | grep -v '^\s*$'
# restore
node "$R/patch-lookbehind-experiment.mjs" "$A" restore
mv "$PRE"/* "$A"/ && rmdir "$PRE"
kill "$(cat "$R/prod-app.pid")" 2>/dev/null || true; sleep 3
bash "$R/start-prod-app.sh" "$REPO"
echo "restored; git status of dist is untracked anyway - verify with: ls $A/workspace-checkout-display-*"
