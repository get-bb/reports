#!/usr/bin/env bash
# Reproduce #2160 on the ACP (Cursor) provider from a bb source checkout.
# Needs: scripts/bb-dev-app current already running, cursor-agent on PATH, a project id.
set -euo pipefail
PROJ="${1:?project id}"
eval "$(scripts/bb-dev-app env)"
PROMPT="Reply with exactly one line: the model name you are running as, nothing else."
THR=$(pnpm -s bb:dev thread spawn --project "$PROJ" --provider acp-cursor --model gpt-5.4-mini-low \
  --permission-mode accept-edits --prompt "$PROMPT" --json | jq -r .id)
pnpm -s bb:dev thread wait "$THR"
# picker change == a different model on the follow-up
pnpm -s bb:dev thread tell "$THR" --model cursor-grok-4.6-medium --reasoning-level low "$PROMPT"
pnpm -s bb:dev thread wait "$THR"
echo "--- answers (expected second to be 'Cursor Grok 4.6'):"
pnpm -s bb:dev thread log "$THR" | grep -A1 "Assistant" | grep -v -- "--"
echo "--- requested models:"
sqlite3 "$(scripts/bb-dev-app status | awk -F': ' '/Data dir/{print $2}')/bb.db" \
  "select sequence, json_extract(data,'\$.source'), json_extract(data,'\$.execution.model') from events where thread_id='$THR' and type='client/turn/requested'"
echo "--- live cursor-agent processes (one, with the FIRST model):"
ps -eo pid,lstart,args | grep "cursor-agent.*--model" | grep -v -e grep -e auto
echo; echo "Workaround: pnpm bb:dev thread stop $THR; then tell again -> relaunch with the new --model."
