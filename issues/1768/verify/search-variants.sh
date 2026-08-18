#!/usr/bin/env bash
# Runs several `bb thread search` queries against the dev instance and prints a compact summary.
# Usage: BB_SERVER_URL=http://localhost:23111 bash search-variants.sh
set -u
cd "$(dirname "$0")"
CLI="node /home/sawyer/projects/bb/.claude/worktrees/wf_6b6686dc-4c2-10/packages/scripts/dist/commands/run-cli.js"
for q in "Child thread updates" "bb system" "failed" "thr_6nkbcspvmj" "completed"; do
  echo "== bb thread search \"$q\" --json"
  $CLI thread search "$q" --json 2>/dev/null | python3 -c '
import sys,json
raw=sys.stdin.read(); raw=raw[raw.index("{"):]
d=json.loads(raw)
for g in ("active","archived"):
    print(" ",g,"total",d[g]["total"])
    for r in d[g]["results"]:
        for m in r["matches"]:
            print("    ",r["thread"]["id"],m["sourceKind"],"seq",m["sourceSeq"],repr(m["text"][:70]))
'
done
