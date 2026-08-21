#!/bin/bash
# Usage: wait-idle.sh <server-url> <thread-id>
SERVER="$1"; THREAD="$2"
for i in $(seq 1 60); do
  s=$(curl -s "$SERVER/api/v1/threads/$THREAD" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d["status"], d["environmentId"], d["archivedAt"])')
  echo "$i $s"
  case "$s" in idle*|error*) break;; esac
  sleep 3
done
