#!/usr/bin/env bash
# Step 3 of the repro: as the parent, spawn one child that fails (nonexistent
# model) and one that completes. Usage (from repo root, after 00-env.sh):
#   PARENT=thr_xxx PROJECT=proj_xxx bash step3-spawn-children.sh
set -u
CLI="${CLI:-node packages/scripts/dist/commands/run-cli.js}"
OUT="${OUT_DIR:-$(cd "$(dirname "$0")" && pwd)}"
export BB_THREAD_ID="$PARENT"
$CLI thread spawn --project "$PROJECT" --provider codex --permission-mode accept-edits \
  --parent-self --title "1768 child bad-model" --model does-not-exist-model \
  --prompt "Reply only with ok." --json > "$OUT/02-child-bad.json" 2>&1
grep -E '"id"|"parentThreadId"|Error' "$OUT/02-child-bad.json"
$CLI thread spawn --project "$PROJECT" --provider codex --permission-mode accept-edits \
  --parent-self --title "1768 child ok" \
  --prompt "Reply only with ok." --json > "$OUT/03-child-ok.json" 2>&1
grep -E '"id"|"parentThreadId"|Error' "$OUT/03-child-ok.json"
