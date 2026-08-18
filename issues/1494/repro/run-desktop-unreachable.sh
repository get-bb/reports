#!/usr/bin/env bash
# Repro for get-bb/bb#1494: launch the built desktop shell (apps/desktop/dist)
# under Xvfb with a saved `custom` server target that nothing listens on.
# Usage: run-desktop-unreachable.sh <worktree-root> <userdata-dir> <url> <cdp-port> <log>
set -u
ROOT="$1"; UD="$2"; URL="$3"; PORT="$4"; LOG="$5"
mkdir -p "$UD"
printf '{"connectServer":null,"customServerUrl":"%s","target":"custom"}\n' "$URL" > "$UD/server-target.json"
cd "$ROOT/apps/desktop"
export BB_DESKTOP_VERSION_CHECK=0 BB_DESKTOP_AUTO_UPDATE=0 BB_DATA_DIR="$UD/bb-data"
exec xvfb-run -a -s "-screen 0 1400x900x24" ./node_modules/.bin/electron \
  --no-sandbox --user-data-dir="$UD" --remote-debugging-port="$PORT" ${BB_1494_INSPECT:+--inspect=$BB_1494_INSPECT} . > "$LOG" 2>&1
