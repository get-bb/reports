#!/usr/bin/env bash
# Poll a bb thread's status from the server API every N seconds and print a
# timestamped line. Usage: poll-status.sh <server-url> <thread-id> [seconds] [count]
server="$1"; thread="$2"; every="${3:-5}"; count="${4:-60}"
for ((i = 0; i < count; i++)); do
  ts="$(date -u +%T)"
  json="$(curl -s "$server/api/v1/threads/$thread")"
  status="$(printf '%s' "$json" | sed -E 's/.*"status":"([^"]*)".*/\1/')"
  display="$(printf '%s' "$json" | sed -E 's/.*"displayStatus":"([^"]*)".*/\1/')"
  echo "$ts status=$status displayStatus=$display"
  sleep "$every"
done
