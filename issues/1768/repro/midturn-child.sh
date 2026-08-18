#!/usr/bin/env bash
# Delivers a child notification WHILE the parent is mid-turn (steer path), so the
# minimal `bb thread log` format collapses it under "Worked for" and only
# --format verbose prints it. Starts a slow filler turn (sleep 75) on the parent,
# then spawns one bad-model child; the child fails ~15-20 s later.
# Usage (from the bb repo root, after `eval "$(scripts/bb-dev-app env)"`):
#   PARENT=thr_xxx PROJECT=proj_xxx bash midturn-child.sh
# CLI overrides the CLI command (default: node packages/scripts/dist/commands/run-cli.js).
# OUT_DIR is where the spawn JSON is written (default: this script's directory).
set -u
CLI="${CLI:-node packages/scripts/dist/commands/run-cli.js}"
OUT="${OUT_DIR:-$(cd "$(dirname "$0")" && pwd)}"
curl -s -X POST "$BB_SERVER_URL/api/v1/threads/$PARENT/send" -H 'content-type: application/json' \
  -d '{"mode":"queue-if-active","input":[{"type":"text","text":"Filler turn 4: run the shell command (sleep 75; echo done) exactly once, wait for it to finish, then reply only with ok."}]}'; echo
sleep 8
BB_THREAD_ID="$PARENT" $CLI thread spawn --project "$PROJECT" --provider codex --permission-mode accept-edits \
  --parent-self --title "1768 child bad-model (mid-turn)" --model does-not-exist-model \
  --prompt "Reply only with ok." --json > "$OUT/08c-midturn-child.json" 2>&1
grep -E '"id"|Error' "$OUT/08c-midturn-child.json"
$CLI thread wait "$PARENT" --status idle --timeout 400 2>&1 | tail -1
$CLI thread log "$PARENT" --json --limit 100000 2>/dev/null | python3 -c '
import sys,json
for e in json.load(sys.stdin):
    if e["type"]=="client/turn/requested" and "[bb system]" in json.dumps(e["data"]):
        print(e["seq"], e["data"]["target"], repr(e["data"]["input"][0]["text"][:80]))'
