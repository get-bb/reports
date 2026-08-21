#!/bin/zsh
set -u
cd /Users/sawyerhood/.bb-machines/bee.getbb.app/checkouts/bb/.claude/worktrees/wf_21e66a79-f02-6
eval "$(scripts/bb-dev-app env)"
PROJ=proj_yrtm5h4dj9
DB=/Users/sawyerhood/.bb-dev/bb-machines-bee.getbb.app-checkouts-bb-.claude-worktrees-wf_21e66a79-f02-6-ab8f5e53e59d/plugins/automations/data.db
echo "--- list before repair (expect exit 1):"
pnpm bb:dev automation list --project $PROJ 2>&1 | grep -E "too_big|^auto_|ID " ; echo "exit=${pipestatus[1]}"
echo "--- sqlite rewrite of victim-B and created-over-cap prompt, no restart"
sqlite3 "$DB" "update automations set execution = json_set(execution, '\$.prompt', 'Reply only with ok.') where id in ('auto_2tapqsqr0-e','auto_7v8rqgiqcf4');"
sqlite3 "$DB" "select id, length(json_extract(execution,'\$.prompt')) from automations where project_id='$PROJ';"
echo "--- list after repair (expect exit 0, 3 rows):"
pnpm bb:dev automation list --project $PROJ 2>&1 | grep -E "too_big|^auto_|ID " ; echo "exit=${pipestatus[1]}"
echo "--- show victim after repair:"
pnpm bb:dev automation show auto_2tapqsqr0-e --project $PROJ 2>&1 | grep -E "Name|too_big|Runs"; echo "exit=${pipestatus[1]}"
