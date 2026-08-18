#!/usr/bin/env bash
# Re-run repro steps 2-5 against a harness built by setup-harness.sh, calling every
# script by ABSOLUTE path from an unrelated cwd. Requires the packaged app to be up
# (start-prod-app.sh) at $APP (default http://localhost:45031).
# Usage: BB1603_HARNESS=... PLAYWRIGHT_BROWSERS_PATH=... bash rerun-fresh-harness.sh <bb repo root> [appUrl]
set -u
REPO=${1:?bb repo root}
APP=${2:-http://localhost:45031}
R=/tmp/bb-reports/issues/1603/repro
OUT=/tmp/bb-reports/issues/1603/fresh-harness
mkdir -p "$OUT"
cd /   # deliberately not the harness dir
echo "harness=${BB1603_HARNESS:-/tmp/bb-1603-wk} browsers=${PLAYWRIGHT_BROWSERS_PATH:-~/.cache/ms-playwright}"
echo "== step 2: feature probe, webkit-1724"
bash "$R/run-old-webkit160.sh" "$R/wk-feature-probe.mjs" | tee "$OUT/feature-probe-wk160.log" | grep -A1 'lookbehind\|static block' | grep -v '^--'
echo "== step 2b: feature probe, webkit-1837"
bash "$R/run-webkit164.sh" "$R/wk-feature-probe.mjs" | tee "$OUT/feature-probe-wk164.log" | grep -A1 'lookbehind\|static block' | grep -v '^--'
echo "== step 3: iPhone 8 Plus on webkit-1724 (crash expected)"
bash "$R/run-old-webkit160.sh" "$R/wk-load-and-wait.mjs" "$APP" "$OUT/wk160-prod" 20000 | tee "$OUT/wk160-prod.log" | grep -v '^\s*$' | head -20
echo "== step 4: pin the regexes"
bash "$R/run-old-webkit160.sh" "$R/webkit-find-bad-regex.mjs" "$APP" "$REPO"/packages/bb-app/app/dist/assets/workspace-checkout-display-*.js "$REPO"/packages/bb-app/app/dist/assets/worker-portable-*.js | tee "$OUT/find-bad-regex.log" | grep -v '^\s*$' | cut -c1-200
echo "== step 5: webkit-1837 with RegExp v flag rejected (crash expected)"
bash "$R/run-webkit164.sh" "$R/wk-load-no-vflag.mjs" "$APP/" "$OUT/wk164-novflag" 12000 | tee "$OUT/wk164-novflag.log" | grep -v '^\s*$' | head -20
echo "== step 5 control: webkit-1837 native (home screen expected)"
bash "$R/run-webkit164.sh" "$R/wk-load-and-wait.mjs" "$APP/" "$OUT/wk164-control" 12000 | tee "$OUT/wk164-control.log" | grep -v '^\s*$' | head -12
