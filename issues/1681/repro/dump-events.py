#!/usr/bin/env python3
"""Print a compact event log for a bb thread: seq, type, scope, and a hint."""
import json
import sys
import urllib.request

server = sys.argv[1]
thread = sys.argv[2]
with urllib.request.urlopen(f"{server}/api/v1/threads/{thread}/events") as r:
    events = json.load(r)
status = json.load(urllib.request.urlopen(f"{server}/api/v1/threads/{thread}"))
print(f"thread {thread} status={status['status']} displayStatus={status['runtime']['displayStatus']}")
for e in events:
    d = e.get("data") or {}
    t = e["type"]
    hint = ""
    if t == "provider/unhandled":
        msg = ((d.get("rawEvent") or {}).get("params") or {}).get("message") or {}
        role = (msg.get("message") or {}).get("role")
        hint = f"rawType={d.get('rawType')} role={role}"
    elif t == "item/completed" or t == "item/started":
        item = d.get("item") or {}
        text = item.get("text") or item.get("content")
        hint = f"{item.get('type')} {json.dumps(text)[:110]}"
    elif t == "turn/completed":
        hint = f"status={d.get('status')}"
    elif t == "client/turn/requested":
        hint = f"input={json.dumps(d.get('input'))[:80]}"
    elif t == "provider/warning":
        hint = d.get("summary")
    scope = e["scope"].get("turnId", e["scope"]["kind"])
    print(f"{e['seq']:>3} {t:<32} {scope:<12} {hint}")
