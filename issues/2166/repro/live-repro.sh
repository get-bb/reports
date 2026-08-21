#!/bin/zsh
# Live reproduction of get-bb/bb#2166 against an isolated bb dev instance.
# Usage: BB_SERVER_URL=... BB_HOST_DAEMON_PORT=... PROJ=<project id> DATA_DIR=<dev data dir> ./live-repro.sh
# Run from the bb worktree root (uses `pnpm bb:dev`).
set -u
LOG=${LOG:-/tmp/bb-reports/issues/2166/repro/live-cli.log}
: > "$LOG"
DB="$DATA_DIR/plugins/automations/data.db"

run() {
  echo "\$ $*" | tee -a "$LOG"
  "$@" 2>&1 | tee -a "$LOG"
  echo "[exit ${pipestatus[1]}]" | tee -a "$LOG"
  echo | tee -a "$LOG"
}

# 1. Two healthy agent automations in the same project.
run pnpm bb:dev --version
run pnpm bb:dev automation create --project "$PROJ" --name healthy-A --cron '*/5 * * * *' --timezone UTC --prompt 'Reply only with ok.' --provider codex --model gpt-5
run pnpm bb:dev automation create --project "$PROJ" --name victim-B --cron '*/5 * * * *' --timezone UTC --prompt 'Reply only with ok.' --provider codex --model gpt-5

IDS=($(sqlite3 "$DB" "select id from automations where project_id='$PROJ' order by created_at asc;"))
A=${IDS[1]}; B=${IDS[2]}
echo "healthy-A=$A victim-B=$B" | tee -a "$LOG"; echo | tee -a "$LOG"

run pnpm bb:dev automation list --project "$PROJ"
run sqlite3 "$DB" "select id, name, length(execution) as execution_len, length(json_extract(execution,'$.prompt')) as prompt_len from automations where project_id='$PROJ';"

# 2. Over-cap prompt: 8039 chars, like the report.
python3 -c "print('x'*8039, end='')" > /tmp/bb-2166-prompt.md
echo "prompt length: $(wc -c < /tmp/bb-2166-prompt.md)" | tee -a "$LOG"; echo | tee -a "$LOG"
run pnpm bb:dev automation update "$B" --project "$PROJ" --prompt "$(cat /tmp/bb-2166-prompt.md)"

# 3. The row was written anyway.
run sqlite3 "$DB" "select id, name, length(execution) as execution_len, length(json_extract(execution,'$.prompt')) as prompt_len, updated_at from automations where project_id='$PROJ';"

# 4. Blast radius: every read of the project fails, healthy-A included.
run pnpm bb:dev automation show "$B" --project "$PROJ"
run pnpm bb:dev automation list --project "$PROJ"
run pnpm bb:dev automation show "$A" --project "$PROJ"

# 5. Recovery is locked out: a short valid prompt is rejected with the same error.
run pnpm bb:dev automation update "$B" --project "$PROJ" --prompt 'short again'
run sqlite3 "$DB" "select id, length(json_extract(execution,'$.prompt')) as prompt_len from automations where id='$B';"

# 6. Scheduler: the sweep logs 'invalid stored configuration' and never runs it.
run pnpm bb:dev automation runs "$B" --project "$PROJ"
