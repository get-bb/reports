#!/bin/zsh
set -u
cd /Users/sawyerhood/.bb-machines/bee.getbb.app/checkouts/bb/.claude/worktrees/wf_21e66a79-f02-6
eval "$(scripts/bb-dev-app env)"
PROJ=proj_yrtm5h4dj9
DB=/Users/sawyerhood/.bb-dev/bb-machines-bee.getbb.app-checkouts-bb-.claude-worktrees-wf_21e66a79-f02-6-ab8f5e53e59d/plugins/automations/data.db
P=$(python3 -c "print('q'*8039, end='')")
sqlite3 "$DB" "update automations set execution = json_set(execution, '\$.prompt', '$P') where id='auto_7v8rqgiqcf4';"
sqlite3 "$DB" "select id, enabled, length(json_extract(execution,'\$.prompt')) from automations where id='auto_7v8rqgiqcf4';"
echo "--- automations_get:"
curl -s -o /tmp/bb-2166-verify-get.out -w "HTTP %{http_code}\n" -X POST "$BB_SERVER_URL/api/v1/plugins/automations/rpc/automations_get" -H 'content-type: application/json' -d "{\"projectId\":\"$PROJ\",\"automationId\":\"auto_7v8rqgiqcf4\"}"
head -c 400 /tmp/bb-2166-verify-get.out; echo
echo "--- automations_list:"
curl -s -o /tmp/bb-2166-verify-list.out -w "HTTP %{http_code}\n" -X POST "$BB_SERVER_URL/api/v1/plugins/automations/rpc/automations_list" -H 'content-type: application/json' -d "{\"projectId\":\"$PROJ\"}"
head -c 300 /tmp/bb-2166-verify-list.out; echo
echo "--- automations_overview:"
curl -s -o /tmp/bb-2166-verify-ov.out -w "HTTP %{http_code}\n" -X POST "$BB_SERVER_URL/api/v1/plugins/automations/rpc/automations_overview" -H 'content-type: application/json' -d "{}"
python3 -c "import json; d=json.load(open('/tmp/bb-2166-verify-ov.out')); print([a['automation']['name'] for a in d['result']['automations']])" 2>&1 | head -3
grep -c "Skipping malformed automation auto_7v8rqgiqcf4" /Users/sawyerhood/.bb-dev/launchers/bb-machines-bee.getbb.app-checkouts-bb-.claude-worktrees-wf_21e66a79-f02-6/dev.log
# restore
sqlite3 "$DB" "update automations set execution = json_set(execution, '\$.prompt', 'Reply only with ok.') where id='auto_7v8rqgiqcf4';"
