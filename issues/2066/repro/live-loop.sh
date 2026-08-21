#!/usr/bin/env bash
# Live repro for get-bb/bb#2066 against an isolated bb dev instance.
#
# Appends N agentMessage events to an existing thread (directly in the dev
# SQLite db, which the server re-reads per request) and refetches the same
# timeline window after each append -- exactly what the web client does during
# a streaming turn. Samples the server process RSS as it goes.
#
# Usage: live-loop.sh <server-url> <db-path> <thread-id> <env-id> <provider-thread-id> <rounds> <out-csv>
set -euo pipefail
SERVER=$1; DB=$2; THREAD=$3; ENV_ID=$4; PTID=$5; ROUNDS=$6; OUT=$7
PORT=${SERVER##*:}
PID=$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t | head -1)
TURN="turn_repro_$(date +%s)"
seq_now() { sqlite3 "$DB" "select max(sequence) from events where thread_id='$THREAD';"; }
rss_kb() { ps -p "$PID" -o rss= | tr -d ' '; }
append() { # $1 type, $2 item_id|NULL, $3 item_kind|NULL, $4 data-json
  local s; s=$(( $(seq_now) + 1 ))
  sqlite3 "$DB" "insert into events (id,thread_id,environment_id,scope_kind,turn_id,provider_thread_id,sequence,type,item_id,item_kind,data,created_at)
    values ('evt_repro_${s}','$THREAD','$ENV_ID','turn','$TURN','$PTID',$s,'$1',$2,$3,'$4',$(date +%s)000);"
}
fetch() { curl -s -m 30 -o /tmp/2066-timeline.json -w '%{size_download}' "$SERVER/api/v1/threads/$THREAD/timeline"; }

echo "round,maxSeq,responseBytes,rows,serverRssKb" > "$OUT"
echo "server pid=$PID start rss=$(rss_kb)KB thread=$THREAD turn=$TURN" >&2
append 'turn/started' NULL NULL "{\"providerThreadId\":\"$PTID\"}"
for ((i=1; i<=ROUNDS; i++)); do
  append 'item/completed' "'msg_repro_$i'" "'agentMessage'" "{\"providerThreadId\":\"$PTID\",\"item\":{\"type\":\"agentMessage\",\"id\":\"msg_repro_$i\",\"text\":\"chunk $i\"}}"
  bytes=$(fetch)
  rows=$(node -e 'const r=JSON.parse(require("fs").readFileSync("/tmp/2066-timeline.json","utf8"));process.stdout.write(String(r.rows.length)+" "+r.maxSeq)')
  echo "$i,${rows#* },$bytes,${rows% *},$(rss_kb)" >> "$OUT"
done
echo "end rss=$(rss_kb)KB" >&2
