#!/bin/bash
# Usage: dump-events.sh <db-path> <thread-id> [out-file]
# Waits for the first turn/completed, gives the agent time for its unprompted
# follow-up, then dumps every persisted event row for the thread.
DB="$1"; THREAD="$2"; OUT="${3:-/dev/stdout}"
until [ "$(sqlite3 "$DB" "select count(*) from events where thread_id='$THREAD' and type='turn/completed'")" -ge 1 ]; do sleep 1; done
sleep 10
sqlite3 -header -column "$DB" "select seq, type, scope, created_at, substr(data,1,160) as data from events where thread_id='$THREAD' order by seq" > "$OUT"
echo "---- schema columns ----" >> "$OUT"
sqlite3 "$DB" "pragma table_info(events)" | cut -d'|' -f2 | tr '\n' ' ' >> "$OUT"
echo >> "$OUT"
