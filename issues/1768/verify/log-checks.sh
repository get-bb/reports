#!/usr/bin/env bash
# Shows how `bb thread log` windows a long orchestrator thread.
# Usage: BB_SERVER_URL=http://localhost:23111 PARENT=thr_xxx bash log-checks.sh
set -u
cd "$(dirname "$0")"
CLI="node /home/sawyer/projects/bb/.claude/worktrees/wf_6b6686dc-4c2-10/packages/scripts/dist/commands/run-cli.js"

echo "== bb thread log $PARENT --json   (CLI default limit=100)"
$CLI thread log "$PARENT" --json 2>/dev/null > 12-parent-log-json-default.json
python3 - <<'EOF'
import json
d=json.load(open("12-parent-log-json-default.json"))
s=[e["seq"] for e in d]
print("  events returned:",len(d),"min seq",min(s),"max seq",max(s))
print("  contains 'Child thread updates':", any("Child thread updates" in json.dumps(e["data"]) for e in d))
EOF

echo "== bb thread log $PARENT --json --limit 100000"
$CLI thread log "$PARENT" --json --limit 100000 2>/dev/null > 13-parent-log-json-all.json
python3 - <<'EOF'
import json
d=json.load(open("13-parent-log-json-all.json"))
print("  total events on thread:",len(d),"max seq",max(e["seq"] for e in d))
print("  seqs of events containing 'Child thread updates':",[e["seq"] for e in d if "Child thread updates" in json.dumps(e["data"])])
print("  seqs of [bb system] client/turn/requested:",[e["seq"] for e in d if e["type"]=="client/turn/requested" and "[bb system]" in json.dumps(e["data"])])
EOF

echo "== bb thread log $PARENT --limit 500   (human format + --limit)"
$CLI thread log "$PARENT" --limit 500 2>&1 | tail -3

echo "== bb thread log $PARENT   (minimal, default) | grep -c 'bb system'"
$CLI thread log "$PARENT" 2>/dev/null | grep -c "bb system"
echo "== bb thread log $PARENT --format verbose | grep -c 'bb system'"
$CLI thread log "$PARENT" --format verbose 2>/dev/null | grep -c "bb system"
