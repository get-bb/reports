#!/bin/bash
# Issue #1621: run `bb secret request` against a live thread with an arbitrary --purpose text.
#
# Usage:
#   BB_SERVER_URL=http://localhost:<server-port> BB_HOST_DAEMON_PORT=<daemon-port> \
#   BB_THREAD_ID=thr_xxx BB_REPO=/abs/path/to/bb-worktree [BB_SCRATCH=/tmp/bb1621-repo] \
#   bash bb1621-run-secret.sh "<purpose text>" </tmp/out.log>
# The command blocks until the form is answered/cancelled in the app (or via the interactions API)
# or until the client fetch dies (300 s, see the report). Output + "exit=<code> elapsed=<s>s" go to the log.
set -u
: "${BB_SERVER_URL:?set BB_SERVER_URL (scripts/bb-dev-app env)}"
: "${BB_HOST_DAEMON_PORT:?set BB_HOST_DAEMON_PORT (scripts/bb-dev-app env)}"
: "${BB_THREAD_ID:?set BB_THREAD_ID to a live thread id (see step 0 in the report)}"
: "${BB_REPO:?set BB_REPO to the bb worktree}"
BB_SCRATCH="${BB_SCRATCH:-/tmp/bb1621-repo}"
export BB_SERVER_URL BB_HOST_DAEMON_PORT BB_THREAD_ID
CLI="node $BB_REPO/packages/scripts/dist/commands/run-cli.js"
PURPOSE="${1:-Testing the transport — an em dash is here}"
OUT="${2:-/tmp/bb1621-secret1.log}"
cd "$BB_SCRATCH" || exit 2
start=$(date +%s)
$CLI secret request FS_TEST_PROBE --purpose "$PURPOSE" --write-env "$BB_SCRATCH/probe.env" > "$OUT" 2>&1
echo "exit=$? elapsed=$(( $(date +%s) - start ))s" >> "$OUT"
