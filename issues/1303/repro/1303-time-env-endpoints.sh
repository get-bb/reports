#!/usr/bin/env bash
# Usage: BB_SERVER_URL=http://localhost:PORT ./1303-time-env-endpoints.sh <environment id> [rounds]
# Times GET /environments/:id/status and /environments/:id/pull-request (both call the host daemon,
# which runs git / gh on every request; no caching).
set -u
S=${BB_SERVER_URL:?}
ENV_ID=${1:?environment id}
ROUNDS=${2:-3}
for i in $(seq 1 "$ROUNDS"); do
  curl -s -o /dev/null -w "status        %{time_total}s http=%{http_code}\n" "$S/api/v1/environments/$ENV_ID/status"
  curl -s -o /dev/null -w "pull-request  %{time_total}s http=%{http_code}\n" "$S/api/v1/environments/$ENV_ID/pull-request"
  curl -s -o /dev/null -w "thread-like   %{time_total}s http=%{http_code} (GET /environments/:id, DB only, for comparison)\n" "$S/api/v1/environments/$ENV_ID"
done
echo "--- status body:"; curl -s "$S/api/v1/environments/$ENV_ID/status" | head -c 700; echo
echo "--- pull-request body:"; curl -s "$S/api/v1/environments/$ENV_ID/pull-request"; echo
