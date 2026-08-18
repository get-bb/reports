#!/usr/bin/env python3
"""Print the image_probe tool result and the final agent message for a thread.
Usage: dump-thread.py <server-url> <thread-id> [<thread-id>...]"""
import json, sys, urllib.request

server = sys.argv[1]
for tid in sys.argv[2:]:
    with urllib.request.urlopen(f"{server}/api/v1/threads/{tid}/events") as r:
        events = json.load(r)
    print(f"== {tid}")
    for e in events:
        if e["type"] != "item/completed":
            continue
        item = e["data"].get("item") or {}
        if item.get("type") == "toolCall" and "image_probe" in item.get("tool", ""):
            print(f"  tool call   : {item['tool']}")
            print(f"  tool result : {json.dumps(item.get('result'))[:200]}")
        if item.get("type") == "agentMessage":
            print(f"  agent reply : {json.dumps(item.get('text'))}")
