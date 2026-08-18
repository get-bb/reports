#!/usr/bin/env bash
# usage: toggle-workflows.sh <on|off>   (BB_SERVER_URL must point at the dev server)
set -euo pipefail
action=$([ "$1" = "on" ] && echo enable || echo disable)
curl -s -X POST "$BB_SERVER_URL/api/v1/plugins/workflows/$action"
echo
sleep 3
curl -s "$BB_SERVER_URL/api/v1/plugins" | python3 -c '
import sys, json
d = json.load(sys.stdin)
items = d if isinstance(d, list) else d.get("plugins", d.get("items", []))
for p in items:
    if "workflow" in str(p.get("id")):
        print(json.dumps({k: p.get(k) for k in ("id", "status", "state", "enabled")}))
'
