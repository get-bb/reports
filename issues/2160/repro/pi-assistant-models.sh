#!/usr/bin/env bash
# Usage: pi-assistant-models.sh <path-to-pi-session.jsonl>
# Prints every model_change entry and every assistant message's
# provider/model from a Pi bridge session file, in file order.
# (Same idea as the jq one-liner in the issue, without needing jq.)
python3 - "$1" <<'PY'
import json, sys, datetime
path = sys.argv[1]
for line in open(path):
    line = line.strip()
    if not line:
        continue
    e = json.loads(line)
    t = e.get("type")
    ts = e.get("timestamp", "")
    if t == "model_change":
        print(f"{ts}\tmodel_change\t{e.get('provider')}/{e.get('modelId')}")
    elif t == "message":
        m = e.get("message", {})
        if m.get("role") == "assistant":
            u = m.get("usage", {})
            print(f"{ts}\tassistant\t{m.get('provider')}/{m.get('model')}\tin={u.get('input')} out={u.get('output')}")
        elif m.get("role") == "user":
            c = m.get("content")
            text = c if isinstance(c, str) else " ".join(b.get("text","") for b in c if isinstance(b, dict))
            print(f"{ts}\tuser\t{text[:60]!r}")
    elif t == "compaction":
        print(f"{ts}\tcompaction\ttokensBefore={e.get('tokensBefore')}")
PY
