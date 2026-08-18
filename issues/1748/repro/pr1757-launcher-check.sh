#!/usr/bin/env bash
# Issue #1748 / PR #1757 check: does the real launcher (bb-server, source-checkout mode) pass
# --max-old-space-size to the spawned server when BB_SERVER_MAX_OLD_SPACE_MB is set
#   (a) in the process environment, and
#   (b) via `bb-app env set` (the env file), as the PR's docs row claims?
# Usage: BB_REPO=<worktree with PR #1757 checked out and built> ./pr1757-launcher-check.sh
set -u
: "${BB_REPO:?set BB_REPO to the bb worktree root}"
DATA_DIR=/tmp/1748-bbapp-data
PORT=41748
rm -rf "$DATA_DIR"; mkdir -p "$DATA_DIR"
cd "$BB_REPO"

run_and_inspect() {
  local label="$1"; shift
  echo "=== $label"
  # bb-server spawns `node <serverEntry>` with stdio inherit; we only need the child's cmdline.
  env "$@" BB_DATA_DIR="$DATA_DIR" BB_SERVER_PORT="$PORT" BB_HOST_DAEMON_PORT=41749 \
    pnpm exec tsx packages/bb-app/src/bin/bb-server.ts > "$DATA_DIR/$label.log" 2>&1 &
  local launcher=$!
  local child=""
  for _ in $(seq 1 100); do
    sleep 0.2
    child=$(pgrep -f "apps/server/dist/index.js" | while read -r p; do
      if grep -q "BB_DATA_DIR=$DATA_DIR" /proc/$p/environ 2>/dev/null; then echo "$p"; break; fi; done)
    [ -n "$child" ] && break
    if ! kill -0 "$launcher" 2>/dev/null; then break; fi
  done
  if [ -n "$child" ]; then
    echo "server pid $child cmdline:"; tr '\0' ' ' < /proc/$child/cmdline; echo
    echo "server env BB_SERVER_MAX_OLD_SPACE_MB=$(tr '\0' '\n' < /proc/$child/environ | grep '^BB_SERVER_MAX_OLD_SPACE_MB=' | cut -d= -f2-)"
  else
    echo "no server child found; launcher output:"; tail -5 "$DATA_DIR/$label.log"
  fi
  kill -TERM "$launcher" 2>/dev/null; [ -n "$child" ] && kill -TERM "$child" 2>/dev/null
  wait "$launcher" 2>/dev/null
  sleep 0.5
}

run_and_inspect a-process-env BB_SERVER_MAX_OLD_SPACE_MB=333

echo "=== writing the knob with bb-app env set (env file):"
BB_DATA_DIR="$DATA_DIR" BB_SERVER_PORT="$PORT" pnpm exec tsx packages/bb-app/src/bin/bb-app.ts env set BB_SERVER_MAX_OLD_SPACE_MB 444 2>&1 | tail -2
echo "env file contents:"; cat "$DATA_DIR/env" 2>/dev/null || cat "$DATA_DIR"/*.env 2>/dev/null || ls "$DATA_DIR"
run_and_inspect b-env-file

run_and_inspect c-invalid-value BB_SERVER_MAX_OLD_SPACE_MB=abc
