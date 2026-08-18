#!/usr/bin/env python3
"""Print the tool calls / results / text of a Claude Code session transcript (.jsonl)."""
import json, sys

for line in open(sys.argv[1]):
    try:
        o = json.loads(line)
    except Exception:
        continue
    t = o.get("type")
    if t in ("assistant", "user"):
        m = o.get("message", {})
        c = m.get("content")
        if isinstance(c, list):
            for b in c:
                if b.get("type") == "tool_use":
                    print("TOOL_USE", json.dumps(b.get("input"))[:500])
                elif b.get("type") == "tool_result":
                    print("TOOL_RESULT", json.dumps(b.get("content"))[:500])
                elif b.get("type") == "text":
                    print("TEXT", b.get("text")[:300])
        elif isinstance(c, str):
            print(t.upper(), c[:300])
    elif t not in ("progress", "file-history-snapshot", "queue-operation"):
        print(t, json.dumps(o)[:400])
