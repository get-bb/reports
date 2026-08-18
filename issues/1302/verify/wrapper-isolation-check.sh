#!/usr/bin/env bash
# Revision check: the fixed 1302-bb.sh must ignore an inherited BB_SERVER_URL.
echo "# shell env before: BB_SERVER_URL=${BB_SERVER_URL:-} BB_THREAD_ID=${BB_THREAD_ID:-} BB_HOST_DAEMON_PORT=${BB_HOST_DAEMON_PORT:-}"
echo '$ BB_REPO=/home/sawyer/projects/bb/.claude/worktrees/wf_6b6686dc-4c2-31 1302/repro/1302-bb.sh machine list --json'
BB_REPO=/home/sawyer/projects/bb/.claude/worktrees/wf_6b6686dc-4c2-31 /tmp/bb-reports/issues/1302/repro/1302-bb.sh machine list --json 2>&1
echo '$ curl -s http://localhost:22777/api/v1/hosts | jq -c "[.[]|{id,name}]"'
curl -s http://localhost:22777/api/v1/hosts | jq -c '[.[]|{id,name}]'
