#!/usr/bin/env bash
# Reproduce #1529 through bb itself: spawn an acp-cursor thread on the scratch
# repo and send the scripted prompt. Prints the thread id.
#
# Usage (from your bb worktree, with a dev instance running):
#   scripts/bb-dev-app current            # once; prints App/Server/Host daemon URLs
#   eval "$(scripts/bb-dev-app env)"      # exports BB_SERVER_URL etc.
#   HOST=$(node packages/scripts/dist/commands/run-cli.js machine list --json \
#          | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s)[0].id))')
#   PROJECT=$(curl -s -X POST "$BB_SERVER_URL/api/v1/projects" -H 'content-type: application/json' \
#     -d "{\"name\":\"qa1529\",\"source\":{\"type\":\"local_path\",\"path\":\"/tmp/bb1529/base\",\"hostId\":\"$HOST\"}}" \
#     | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).id))')
#   BB_WORKTREE=$PWD bash /path/to/repro/run-bb-cursor.sh "$PROJECT"
#   node packages/scripts/dist/commands/run-cli.js thread wait <thread id>
#   node packages/scripts/dist/commands/run-cli.js thread log <thread id> --format verbose
#
# Equivalent raw command (what bbdev.sh runs):
#   bb thread spawn --json --project <project> --environment /tmp/bb1529/base \
#      --provider acp-cursor --permission-mode full --title "1529 cursor repro" --prompt "$(cat prompt.txt)"
#
# Outputs go to $OUT (default /tmp/bb1529-out) so re-runs do not clobber the
# archived evidence next to this script.
set -uo pipefail
REPRO="$(cd "$(dirname "$0")" && pwd)"
OUT="${OUT:-/tmp/bb1529-out}"; mkdir -p "$OUT"
BB="$REPRO/bbdev.sh"
PROJECT="${1:?project id}"
bash "$REPRO/setup.sh"
"$BB" thread spawn --json --project "$PROJECT" --environment /tmp/bb1529/base \
  --provider acp-cursor --permission-mode full --title "1529 cursor repro" \
  --prompt "$(cat "$REPRO/prompt.txt")" | tee "$OUT/bb-cursor-spawn.json"
