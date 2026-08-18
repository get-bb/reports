#!/bin/bash
# Issue #1621 live repro: bundled tasks plugin puts the raw attachment file name into
# Content-Disposition; a non-Latin-1 name (em dash) makes the download route 500 and
# logs "Cannot convert argument to a ByteString ... 8212" (N+1 times per request).
#
# Usage:
#   BB_SERVER_URL=http://localhost:<server-port> BB_HOST_DAEMON_PORT=<daemon-port> \
#   BB_REPO=/abs/path/to/bb-worktree BB_MACHINE=<name from bb machine list> [BB_DATA_DIR=~/.bb-dev/<instance>] \
#   bash bb1621-tasks-attachment.sh
# Prereqs: `scripts/bb-dev-app current` running, `pnpm bb:dev` run once (builds the CLI).
set -u
: "${BB_SERVER_URL:?set BB_SERVER_URL (scripts/bb-dev-app env)}"
: "${BB_HOST_DAEMON_PORT:?set BB_HOST_DAEMON_PORT (scripts/bb-dev-app env)}"
: "${BB_REPO:?set BB_REPO to the bb worktree}"
: "${BB_MACHINE:?set BB_MACHINE to a machine name/id from: bb machine list}"
export BB_SERVER_URL BB_HOST_DAEMON_PORT
CLI="node $BB_REPO/packages/scripts/dist/commands/run-cli.js"
NAME="report — final.txt"

$CLI plugin install builtin:tasks --yes >/dev/null 2>&1 || true
sleep 2
$CLI tasks project create --name "QA 1621" --prefix Q1621 --json >/dev/null 2>&1 || true
TASK_JSON=$($CLI tasks create --project Q1621 --title "1621 repro" --json)
KEY=$(printf '%s' "$TASK_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.key??j.task?.key)})')
echo "task key: $KEY"

printf 'hello\n' > /tmp/bb1621-attachment.txt
echo "--- upload as \"$NAME\""
ADD_JSON=$($CLI tasks attachment add "$KEY" --file /tmp/bb1621-attachment.txt --name "$NAME" --machine "$BB_MACHINE" --json)
echo "$ADD_JSON"
ATT_ID=$(printf '%s' "$ADD_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.attachmentId??j.attachment?.id??j.id)})')
echo "attachment id: $ATT_ID"

echo "--- download via CLI (bb tasks attachment get)"
$CLI tasks attachment get "$ATT_ID" --out /tmp/bb1621-downloaded.txt --machine "$BB_MACHINE"; echo "exit=$?"

echo "--- download via raw HTTP"
curl -s -o /tmp/bb1621-download-body.txt -w 'HTTP %{http_code} content-type=%{content_type}\n' \
  "$BB_SERVER_URL/api/v1/plugins/tasks/http/attachments/download?attachmentId=$ATT_ID"
cat /tmp/bb1621-download-body.txt; echo

if [ -n "${BB_DATA_DIR:-}" ]; then
  sleep 2  # pino flushes asynchronously
  echo "--- server log lines for this request (last 8 ByteString errors)"
  grep -h "Cannot convert argument to a ByteString" "$BB_DATA_DIR"/logs/server*.log | tail -8 | cut -c1-400
  echo "count of ByteString lines in server log: $(cat "$BB_DATA_DIR"/logs/server*.log | grep -c 'Cannot convert argument to a ByteString')"
fi
