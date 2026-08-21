#!/bin/zsh
# Contrast: the same over-cap update sent through the plugin RPC route (what the
# web app uses) is rejected by INPUT validation before the handler runs, so the
# row is untouched. Only the CLI path (service called directly) skips that step.
set -u
LOG=${LOG:-/tmp/bb-reports/issues/2166/repro/rpc-contrast.log}
: > "$LOG"
DB="$DATA_DIR/plugins/automations/data.db"
PROMPT=$(python3 -c "print('y'*8039, end='')")
BODY=$(python3 -c "import json,sys; print(json.dumps({'projectId': sys.argv[1], 'automationId': sys.argv[2], 'agent': {'prompt': sys.argv[3]}}))" "$PROJ" "$HEALTHY" "$PROMPT")
echo "\$ curl -s -X POST \$BB_SERVER_URL/api/v1/plugins/automations/rpc/automations_update -H 'content-type: application/json' -d '{\"projectId\":\"$PROJ\",\"automationId\":\"$HEALTHY\",\"agent\":{\"prompt\":\"<8039 chars>\"}}'" | tee -a "$LOG"
curl -s -o /tmp/bb-2166-rpc.out -w "HTTP %{http_code}\n" -X POST "$BB_SERVER_URL/api/v1/plugins/automations/rpc/automations_update" -H 'content-type: application/json' -d "$BODY" | tee -a "$LOG"
cat /tmp/bb-2166-rpc.out | tee -a "$LOG"; echo | tee -a "$LOG"
echo "\$ sqlite3 data.db \"select id, length(json_extract(execution,'\$.prompt')) from automations where id='$HEALTHY';\"" | tee -a "$LOG"
sqlite3 "$DB" "select id, length(json_extract(execution,'\$.prompt')) as prompt_len from automations where id='$HEALTHY';" | tee -a "$LOG"
