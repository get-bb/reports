#!/bin/zsh
# Same defect on `bb automation create`: the row is inserted, then the
# response serializer rejects it.
set -u
LOG=${LOG:-/tmp/bb-reports/issues/2166/repro/live-create.log}
: > "$LOG"
DB="$DATA_DIR/plugins/automations/data.db"
run() {
  echo "\$ $*" | tee -a "$LOG"
  "$@" 2>&1 | tee -a "$LOG"
  echo "[exit ${pipestatus[1]}]" | tee -a "$LOG"
  echo | tee -a "$LOG"
}
run sqlite3 "$DB" "select count(*) as rows_before from automations where project_id='$PROJ';"
run pnpm bb:dev automation create --project "$PROJ" --name created-over-cap --cron '*/5 * * * *' --timezone UTC --prompt "$(python3 -c "print('z'*8039, end='')")" --provider codex --model gpt-5
run sqlite3 "$DB" "select id, name, length(json_extract(execution,'\$.prompt')) as prompt_len from automations where project_id='$PROJ' order by created_at;"
