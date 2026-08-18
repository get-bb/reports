#!/usr/bin/env bash
# Run `bb voice transcribe` against a dev instance that was started from a bb
# worktree with NODE_OPTIONS="--import cf-challenge-preload.mjs".
#   ./run-cli-transcribe.sh baseline   -> real network (flag file removed)
#   ./run-cli-transcribe.sh challenge  -> simulated Cloudflare challenge
#
# Configuration comes from the environment, not from this file:
#   WORKTREE        absolute path of your built bb worktree (default: $PWD)
#   BB_SERVER_URL   your dev server URL; set it with `eval "$(scripts/bb-dev-app env)"`
#   BB_PROJECT_ID   defaults to proj_personal
#   CF_PRELOAD_DIR  where the preload keeps its flag file + log
#                   (default /tmp/bb-1587-preload; must match the value the
#                   dev instance was started with, if you overrode it)
set -u
WORKTREE=${WORKTREE:-$PWD}
: "${BB_SERVER_URL:?set BB_SERVER_URL, e.g. eval \"\$(scripts/bb-dev-app env)\" in your worktree}"
export BB_SERVER_URL BB_PROJECT_ID=${BB_PROJECT_ID:-proj_personal}
PRELOAD_DIR=${CF_PRELOAD_DIR:-/tmp/bb-1587-preload}
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
mkdir -p "$PRELOAD_DIR"
unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE NODE_OPTIONS
CLI="$WORKTREE/packages/scripts/dist/commands/run-cli.js"
[[ -f "$CLI" ]] || { echo "not found: $CLI (set WORKTREE to a built bb worktree)"; exit 2; }
mode=${1:-baseline}
if [[ "$mode" == "challenge" ]]; then touch "$PRELOAD_DIR/FORCE_CF_CHALLENGE"; else rm -f "$PRELOAD_DIR/FORCE_CF_CHALLENGE"; fi
LOG="$PRELOAD_DIR/cf-challenge-preload.log"
before=$( [[ -f "$LOG" ]] && wc -l < "$LOG" || echo 0 )
echo "\$ bb voice transcribe tone.mp3 --type audio/mpeg   # mode=$mode server=$BB_SERVER_URL"
node "$CLI" voice transcribe "$HERE/tone.mp3" --type audio/mpeg
echo "exit=$?"
if [[ -f "$LOG" ]]; then
  echo "--- daemon fetch calls intercepted by the preload during this run ($LOG):"
  tail -n +$((before + 1)) "$LOG"
fi
