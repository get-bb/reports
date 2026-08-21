#!/bin/zsh
set -u
cd /Users/sawyerhood/.bb-machines/bee.getbb.app/checkouts/bb/.claude/worktrees/wf_21e66a79-f02-6
eval "$(scripts/bb-dev-app env)"
DB=/Users/sawyerhood/.bb-dev/bb-machines-bee.getbb.app-checkouts-bb-.claude-worktrees-wf_21e66a79-f02-6-ab8f5e53e59d/plugins/automations/data.db
P=$(python3 -c "print('q'*8039, end='')")
sqlite3 "$DB" "update automations set execution = json_set(execution, '\$.prompt', '$P') where id='auto_7v8rqgiqcf4';"
curl -s -o /tmp/bb-2166-verify-ov.out -w "HTTP %{http_code}\n" -X POST "$BB_SERVER_URL/api/v1/plugins/automations/rpc/automations_overview" -H 'content-type: application/json' -d "null"
python3 -c "import json; d=json.load(open('/tmp/bb-2166-verify-ov.out')); print('overview names:', [a['automation']['name'] for a in d['result']['automations']])"
echo "WARN lines:"; grep "Skipping malformed automation auto_7v8rqgiqcf4" /Users/sawyerhood/.bb-dev/launchers/bb-machines-bee.getbb.app-checkouts-bb-.claude-worktrees-wf_21e66a79-f02-6/dev.log | tail -1 | cut -c1-160
sqlite3 "$DB" "update automations set execution = json_set(execution, '\$.prompt', 'Reply only with ok.') where id='auto_7v8rqgiqcf4';"
