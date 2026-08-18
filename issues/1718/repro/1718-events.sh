#!/usr/bin/env bash
# Summarize a thread's events: seq, time, type, and a short payload excerpt.
# Usage: BB_SERVER_URL=http://localhost:PORT 1718-events.sh <thread id>
set -euo pipefail
: "${BB_SERVER_URL:?}"
curl -s "$BB_SERVER_URL/api/v1/threads/$1/events?limit=1000" | jq -r '
  .[] | [ .seq,
          (.createdAt/1000 | strftime("%H:%M:%S")),
          .type,
          (.scope.turnId // ""),
          ((.data | tostring) | .[0:150]) ] | @tsv'
