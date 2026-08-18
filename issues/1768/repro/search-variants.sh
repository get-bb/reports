#!/usr/bin/env bash
# Runs several `bb thread search` queries against the dev instance and prints a compact summary.
# Usage (from the bb repo root, after `eval "$(scripts/bb-dev-app env)"`):
#   CHILD=thr_xxx bash search-variants.sh     # CHILD = id of a child that failed (optional)
# CLI overrides the CLI command (default: node packages/scripts/dist/commands/run-cli.js).
set -u
CLI="${CLI:-node packages/scripts/dist/commands/run-cli.js}"
CHILD="${CHILD:-}"
for q in "Child thread updates" "bb system" "failed" ${CHILD:+"$CHILD"} "completed"; do
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
