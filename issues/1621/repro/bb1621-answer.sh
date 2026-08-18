#!/bin/bash
# Issue #1621 helper: answer (or cancel) the pending secret-request interaction of a thread
# through the same API the app UI uses.
#
# Usage:
#   BB_SERVER_URL=http://localhost:<server-port> BB_THREAD_ID=thr_xxx \
#   bash bb1621-answer.sh respond            # fills FS_TEST_PROBE=hunter2
#   bash bb1621-answer.sh cancel
set -u
: "${BB_SERVER_URL:?set BB_SERVER_URL}"
: "${BB_THREAD_ID:?set BB_THREAD_ID}"
ACTION="${1:-respond}"
LIST=$(curl -s "$BB_SERVER_URL/api/v1/threads/$BB_THREAD_ID/interactions")
PINT=$(printf '%s' "$LIST" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const j=JSON.parse(s); const items=Array.isArray(j)?j:(j.interactions??j.items??[]);
  const p=items.find(i=>i.status==="pending")||items.at(-1);
  if(!p){console.error("no interaction found");process.exit(1)}
  console.error("interaction "+p.id+" status="+p.status+" purpose="+JSON.stringify(p.payload?.data?.purpose));
  console.log(p.id)})')
[ -z "$PINT" ] && exit 1
if [ "$ACTION" = "cancel" ]; then
  curl -s -X POST "$BB_SERVER_URL/api/v1/threads/$BB_THREAD_ID/interactions/$PINT/cancel" -H 'content-type: application/json' -d '{}'
else
  curl -s -X POST "$BB_SERVER_URL/api/v1/threads/$BB_THREAD_ID/interactions/$PINT/respond" \
    -H 'content-type: application/json' -d '{"value":{"values":{"FS_TEST_PROBE":"hunter2"}}}'
fi
echo
