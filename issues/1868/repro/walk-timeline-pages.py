#!/usr/bin/env python3
"""Walk every timeline page of a bb thread through the HTTP API and print the
rows on each page. usage: walk-timeline-pages.py <server-url> <thread-id>"""
import json, sys, urllib.request, urllib.parse
server, thread = sys.argv[1], sys.argv[2]
cursor = None
page = 0
all_turn_ids = []
while True:
    page += 1
    q = {"includeNestedRows": "false", "segmentLimit": "20"}
    if cursor:
        q["beforeAnchorSeq"] = str(cursor["anchorSeq"]); q["beforeAnchorId"] = cursor["anchorId"]
    url = f"{server}/api/v1/threads/{thread}/timeline?{urllib.parse.urlencode(q)}"
    d = json.load(urllib.request.urlopen(url))
    tp = d["timelinePage"]
    print(f"--- page {page}: rows={len(d['rows'])} kind={tp['kind']} hasOlderRows={tp['hasOlderRows']} olderCursor={json.dumps(tp['olderCursor'])}")
    for r in d["rows"]:
        extra = ""
        if r["kind"] == "turn":
            extra = f" turnId={r.get('turnId')} status={r.get('status')} startedAt={r.get('startedAt')} completedAt={r.get('completedAt')}"
            all_turn_ids.append(r["id"])
        print(f"    {r['kind']} {r['id']} seq {r.get('sourceSeqStart')}-{r.get('sourceSeqEnd')}{extra}")
    if not tp["hasOlderRows"]:
        break
    cursor = tp["olderCursor"]
    if page > 50:
        break
print(f"total pages {page}; turn rows {len(all_turn_ids)}; distinct turn row ids {len(set(all_turn_ids))}")
