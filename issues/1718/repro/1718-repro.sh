#!/usr/bin/env bash
# End-to-end repro of #1718 against YOUR bb dev instance.
#
# Usage: BB_REPO=/abs/bb/worktree ./1718-repro.sh <project id> [idle|active]
#   idle   (default) Claude backgrounds `sleep 120`, replies "started", thread
#                    goes idle -> `bb thread stop` (release) -> new message.
#   active           Claude backgrounds `sleep 120` and keeps polling it, so the
#                    turn is still running -> `bb thread stop` (interrupt) -> new message.
#
# Needs: sqlite3 not required; jq, curl. Uses ./1718-bb.sh and ./1718-events.sh
# next to this script. Real claude-code usage (two tiny turns).
set -euo pipefail
: "${BB_REPO:?set BB_REPO to your bb worktree root}"
HERE="$(cd "$(dirname "$0")" && pwd)"
BB="$HERE/1718-bb.sh"
eval "$("$BB_REPO/scripts/bb-dev-app" env)"
PROJECT="${1:?project id}"
MODE="${2:-idle}"

if [ "$MODE" = "active" ]; then
  PROMPT="Use the Bash tool with run_in_background set to true to run: sleep 120; echo BG_DONE. Then wait for it to finish by running the Bash tool 'sleep 15' repeatedly (not in background) and checking the output file each time, until you see BG_DONE. Only then reply with the word: done."
else
  PROMPT="Use the Bash tool with run_in_background set to true to run the command: sleep 120; echo BG_DONE. Once it is started in the background, reply with exactly the word: started. Do not wait for it and do not do anything else."
fi

echo "--- spawning claude-code thread ($MODE)"
THREAD=$("$BB" thread spawn --project "$PROJECT" --provider claude-code --permission-mode accept-edits --title "1718 $MODE" --prompt "$PROMPT" --json | jq -r .id)
echo "thread=$THREAD"

status() { curl -s "$BB_SERVER_URL/api/v1/threads/$THREAD" | jq -r .status; }
has_bg_task() {
  curl -s "$BB_SERVER_URL/api/v1/threads/$THREAD/events?limit=1000" \
    | jq -e '[.[] | select(.type=="item/started" and .data.item.type=="backgroundTask")] | length > 0' >/dev/null
}

if [ "$MODE" = "active" ]; then
  echo "--- waiting for the background task to start (turn stays active)"
  until has_bg_task; do sleep 1; done
  sleep 3
else
  echo "--- waiting for the thread to go idle (background task still running)"
  until [ "$(status)" = "idle" ]; do sleep 1; done
fi
echo "status before stop: $(status)"

echo "--- $(date -u +%T) bb thread stop"
"$BB" thread stop "$THREAD"
echo "--- $(date -u +%T) bb thread tell (the message this issue is about)"
"$BB" thread tell "$THREAD" "SECOND_MSG: what is 2+2? Reply with exactly the number."
echo "--- $(date -u +%T) bb thread wait --status idle"
"$BB" thread wait "$THREAD" --status idle --timeout 120 >/dev/null
echo "--- $(date -u +%T) thread idle again. Events so far:"
BB_SERVER_URL="$BB_SERVER_URL" "$HERE/1718-events.sh" "$THREAD" | awk -F'\t' '{print $1"\t"$2"\t"$3"\t"$4"\t"substr($5,1,110)}'
echo "--- waiting 25s more for the unsolicited turn"
sleep 25
echo "--- events (tail):"
BB_SERVER_URL="$BB_SERVER_URL" "$HERE/1718-events.sh" "$THREAD" | awk -F'\t' '{print $1"\t"$2"\t"$3"\t"$4"\t"substr($5,1,110)}' | tail -20
echo "--- bb thread log tail:"
"$BB" thread log "$THREAD" | tail -25
echo "thread=$THREAD"
