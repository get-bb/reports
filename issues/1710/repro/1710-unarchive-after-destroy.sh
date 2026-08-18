#!/bin/bash
# Issue #1710: after the archive grace window elapsed and the managed worktree
# was destroyed, try every "continue the conversation" path the product offers.
# Usage: BB_REPO=/abs/path/to/bb/worktree ./1710-unarchive-after-destroy.sh <thread id>
set -u
: "${BB_REPO:?set BB_REPO}"
THREAD="${1:?thread id}"
BB="$(dirname "$0")/1710-bb.sh"
eval "$("$BB_REPO/scripts/bb-dev-app" env)"

echo "\$ bb thread show $THREAD --json | jq '{archivedAt,status,env,path}'"
"$BB" thread show "$THREAD" --json | jq '{archivedAt:.thread.archivedAt,status:.thread.status,env:.environment.status,path:.environment.path}'

echo "\$ bb thread unarchive $THREAD"
"$BB" thread unarchive "$THREAD"; echo "exit=$?"

echo "\$ bb thread show $THREAD --json | jq '{archivedAt,status,env,path}'"
"$BB" thread show "$THREAD" --json | jq '{archivedAt:.thread.archivedAt,status:.thread.status,env:.environment.status,path:.environment.path}'

echo "\$ bb thread tell $THREAD 'Reply only with ok.'"
"$BB" thread tell "$THREAD" "Reply only with ok."; echo "exit=$?"

echo "\$ curl -X POST \$BB_SERVER_URL/api/v1/threads/$THREAD/send   (raw server response)"
curl -s -X POST "$BB_SERVER_URL/api/v1/threads/$THREAD/send" -H 'content-type: application/json' \
  -d '{"mode":"auto","input":[{"type":"text","text":"Reply only with ok.","mentions":[]}]}'; echo
