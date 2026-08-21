#!/usr/bin/env bash
# Usage: wait-idle.sh <thread-id> [server-url]
# Polls the bb server until the thread is idle or errored.
# The server URL defaults to $BB_SERVER_URL, which `eval "$(scripts/bb-dev-app env)"` sets.
THREAD="$1"
SERVER="${2:-${BB_SERVER_URL:?set BB_SERVER_URL (eval \"\$(scripts/bb-dev-app env)\") or pass the server URL as arg 2}}"
for i in $(seq 1 90); do
  s=$(curl -s "$SERVER/api/v1/threads/$THREAD" | python3 -c "import sys,json;print(json.load(sys.stdin)['status'])")
  echo "$(date +%T) poll $i status=$s"
  if [ "$s" = "idle" ] || [ "$s" = "error" ]; then exit 0; fi
  sleep 2
done
exit 1
