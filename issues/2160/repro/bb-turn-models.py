#!/usr/bin/env python3
"""Usage: bb-turn-models.py <thread-id> [server-url]

The server URL defaults to $BB_SERVER_URL (set by `eval "$(scripts/bb-dev-app env)"`).

Fetches the bb thread event log and prints, per turn, the model bb recorded
on `client/turn/requested` next to the provider-side session lifecycle events
(thread/start, thread/resume, turn/started, turn/completed, provider/error).
"""
import json
import os
import sys
import urllib.request

thread = sys.argv[1]
server = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("BB_SERVER_URL")
if not server:
    sys.exit('set BB_SERVER_URL (eval "$(scripts/bb-dev-app env)") or pass the server URL as arg 2')
with urllib.request.urlopen(f"{server}/api/v1/threads/{thread}/events?limit=500") as r:
    d = json.load(r)
evs = d if isinstance(d, list) else d.get("events", d.get("items", []))


def find_model(obj):
    if isinstance(obj, dict):
        if "model" in obj and isinstance(obj["model"], str):
            return obj["model"]
        for v in obj.values():
            m = find_model(v)
            if m:
                return m
    elif isinstance(obj, list):
        for v in obj:
            m = find_model(v)
            if m:
                return m
    return None


for e in evs:
    p = e.get("payload", e)
    t = p.get("type")
    data = p.get("data", {})
    if t == "client/turn/requested":
        print(p["seq"], t, "model=" + str(find_model(data)), "source=" + str(data.get("source")))
    elif t in ("client/thread/start", "client/thread/resume", "thread/identity", "turn/started", "thread/compacted"):
        print(p["seq"], t)
    elif t == "turn/completed":
        print(p["seq"], t, data.get("status"))
    elif t == "provider/error":
        print(p["seq"], t, str(data.get("detail"))[:200])
    elif t == "item/completed" and data.get("item", {}).get("type") == "agentMessage":
        print(p["seq"], "agentMessage", json.dumps(data["item"].get("text", ""))[:80])
