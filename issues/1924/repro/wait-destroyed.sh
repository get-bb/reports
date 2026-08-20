#!/usr/bin/env bash
# Poll the environment until the archive grace window (5 min) elapses and the
# server destroys it.
SERVER="${1:-http://localhost:23833}"
ENV_ID="${2:?env id}"
for i in $(seq 1 45); do
  status=$(curl -s "$SERVER/api/v1/environments/$ENV_ID" | sed 's/.*"status":"\([a-z]*\)".*/\1/')
  echo "$(date +%T) $status"
  if [ "$status" = "destroyed" ]; then exit 0; fi
  sleep 10
done
exit 1
