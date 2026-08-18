#!/usr/bin/env bash
# Shows how `bb thread log` windows a long orchestrator thread.
# Usage (from the bb repo root, after `eval "$(scripts/bb-dev-app env)"`):
#   PARENT=thr_xxx bash log-checks.sh
# CLI overrides the CLI command (default: node packages/scripts/dist/commands/run-cli.js).
# OUT_DIR is where the two JSON dumps are written (default: this script's directory).
set -u
CLI="${CLI:-node packages/scripts/dist/commands/run-cli.js}"
OUT="${OUT_DIR:-$(cd "$(dirname "$0")" && pwd)}"

echo "== bb thread log $PARENT --json   (CLI default limit=100)"
$CLI thread log "$PARENT" --json 2>/dev/null > "$OUT/12-parent-log-json-default.json"
python3 - "$OUT/12-parent-log-json-default.json" <<'EOF'
import json,sys
d=json.load(open(sys.argv[1]))
s=[e["seq"] for e in d]
print("  events returned:",len(d),"min seq",min(s),"max seq",max(s))
print("  seqs of [bb system] client/turn/requested IN this window:",[e["seq"] for e in d if e["type"]=="client/turn/requested" and "[bb system]" in json.dumps(e["data"])])
EOF

echo "== bb thread log $PARENT --json --limit 100000"
$CLI thread log "$PARENT" --json --limit 100000 2>/dev/null > "$OUT/13-parent-log-json-all.json"
python3 - "$OUT/13-parent-log-json-all.json" <<'EOF'
import json,sys
d=json.load(open(sys.argv[1]))
print("  total events on thread:",len(d),"max seq",max(e["seq"] for e in d),"(seq gaps are normal: delta/streaming rows are pruned)")
print("  seqs of events containing 'Child thread updates':",[e["seq"] for e in d if "Child thread updates" in json.dumps(e["data"])])
sys_seqs=[e["seq"] for e in d if e["type"]=="client/turn/requested" and "[bb system]" in json.dumps(e["data"])]
print("  seqs of ALL [bb system] client/turn/requested:",sys_seqs)
default_max=max(e["seq"] for e in json.load(open(sys.argv[1].replace("13-parent-log-json-all","12-parent-log-json-default"))))
print("  => [bb system] messages NOT in the default --json window (seq >",default_max,"):",[q for q in sys_seqs if q>default_max])
EOF

echo "== bb thread log $PARENT --limit 500   (human format + --limit)"
$CLI thread log "$PARENT" --limit 500 2>&1 | tail -3

echo "== bb thread log $PARENT   (minimal, default) | grep -c 'bb system'"
$CLI thread log "$PARENT" 2>/dev/null | grep -c "bb system"
echo "== bb thread log $PARENT --format verbose | grep -c 'bb system'"
$CLI thread log "$PARENT" --format verbose 2>/dev/null | grep -c "bb system"
