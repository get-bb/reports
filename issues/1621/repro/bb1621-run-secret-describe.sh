#!/bin/bash
# Issue #1621: `bb secret request` with em dashes in --purpose and both --describe texts.
# Answer the form in the app UI (or via the interactions API, see bb1621-answer.sh).
#
# Usage:
#   BB_SERVER_URL=http://localhost:<server-port> BB_HOST_DAEMON_PORT=<daemon-port> \
#   BB_THREAD_ID=thr_xxx BB_REPO=/abs/path/to/bb-worktree [BB_SCRATCH=/tmp/bb1621-repo] \
#   bash bb1621-run-secret-describe.sh </tmp/out.log>
set -u
: "${BB_SERVER_URL:?set BB_SERVER_URL (scripts/bb-dev-app env)}"
: "${BB_HOST_DAEMON_PORT:?set BB_HOST_DAEMON_PORT (scripts/bb-dev-app env)}"
: "${BB_THREAD_ID:?set BB_THREAD_ID to a live thread id (see step 0 in the report)}"
: "${BB_REPO:?set BB_REPO to the bb worktree}"
BB_SCRATCH="${BB_SCRATCH:-/tmp/bb1621-repo}"
export BB_SERVER_URL BB_HOST_DAEMON_PORT BB_THREAD_ID
CLI="node $BB_REPO/packages/scripts/dist/commands/run-cli.js"
OUT="${1:-/tmp/bb1621-secret4.log}"
cd "$BB_SCRATCH" || exit 2
start=$(date +%s)
$CLI secret request API_KEY_ONE API_KEY_TWO \
  --purpose "Deploy pipeline — needs two keys" \
  --describe API_KEY_ONE "Primary key — from the vault" \
  --describe API_KEY_TWO "Secondary key — rotate weekly" \
  --write-env "$BB_SCRATCH/probe2.env" > "$OUT" 2>&1
echo "exit=$? elapsed=$(( $(date +%s) - start ))s" >> "$OUT"
