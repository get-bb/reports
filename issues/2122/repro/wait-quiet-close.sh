#!/bin/bash
# Waits for the PR's 120s quiet window to close the vouched turn on thread $2,
# then dumps the tail of both PR-branch threads' events.
DB="$1"; T_OK="$2"; T_CRASH="$3"
until [ "$(sqlite3 "$DB" "select count(*) from events where thread_id='$T_OK' and type='turn/completed'")" -ge 2 ]; do sleep 5; done
echo "second turn/completed observed at $(date +%T)"
sqlite3 -header -column "$DB" "select thread_id, sequence, type, scope_kind, turn_id, created_at, substr(data,1,90) as data from events where thread_id in ('$T_OK','$T_CRASH') and sequence >= 16 order by thread_id, sequence"
