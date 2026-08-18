#!/usr/bin/env bash
# Grows the parent thread past the 100-event `bb thread log --json` default by
# sending three small tool-using prompts (each adds ~25-30 events).
# Usage (from the bb repo root, after `eval "$(scripts/bb-dev-app env)"`):
#   PARENT=thr_xxx bash filler-turns.sh
# CLI overrides the CLI command (default: node packages/scripts/dist/commands/run-cli.js).
set -u
CLI="${CLI:-node packages/scripts/dist/commands/run-cli.js}"
for n in 1 2 3; do
  curl -s -X POST "$BB_SERVER_URL/api/v1/threads/$PARENT/send" -H 'content-type: application/json' \
    -d "{\"mode\":\"queue-if-active\",\"input\":[{\"type\":\"text\",\"text\":\"Filler turn $n: run these shell commands one at a time (ls -la /tmp/bb-1768-scratch ; git -C /tmp/bb-1768-scratch log --oneline ; date ; uname -a ; echo done) and then reply only with ok.\"}]}"; echo
  sleep 5
  $CLI thread wait "$PARENT" --status idle --timeout 300 >/dev/null 2>&1
  $CLI thread log "$PARENT" --json --limit 100000 2>/dev/null | python3 -c 'import sys,json; d=json.load(sys.stdin); print("events:",len(d),"max seq",max(e["seq"] for e in d))'
done
