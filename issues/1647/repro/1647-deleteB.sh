#!/bin/bash
# Usage: 1647-deleteB.sh <threadId> <envId> <workspacePath>
T=$1; ENV=$2; WS=$3
date
curl -s -X DELETE http://localhost:19440/api/v1/threads/$T -H 'content-type: application/json' -d '{"childThreadsConfirmed":true}'
echo
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 3
  echo "--- t+$((i*3))s env status: $(/tmp/1647-bb.sh environment show $ENV --json 2>/dev/null | grep '"status"' | head -1)"
  /tmp/1647-procs.sh "$WS"
done
