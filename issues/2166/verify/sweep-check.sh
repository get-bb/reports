#!/bin/zsh
set -u
cd /Users/sawyerhood/.bb-machines/bee.getbb.app/checkouts/bb/.claude/worktrees/wf_21e66a79-f02-6
eval "$(scripts/bb-dev-app env)"
PROJ=proj_yrtm5h4dj9
DB=/Users/sawyerhood/.bb-dev/bb-machines-bee.getbb.app-checkouts-bb-.claude-worktrees-wf_21e66a79-f02-6-ab8f5e53e59d/plugins/automations/data.db
pnpm bb:dev automation pause auto_xo4-cpsx1u8 --project $PROJ 2>&1 | tail -3
echo "--- sweep skip lines in server log:"
grep -c "Skipping due automation auto_2tapqsqr0-e with invalid stored configuration" /Users/sawyerhood/.bb-dev/launchers/bb-machines-bee.getbb.app-checkouts-bb-.claude-worktrees-wf_21e66a79-f02-6/dev.log
grep -n "Skipping due automation auto_2tapqsqr0-e" /Users/sawyerhood/.bb-dev/launchers/bb-machines-bee.getbb.app-checkouts-bb-.claude-worktrees-wf_21e66a79-f02-6/dev.log | head -3
echo "--- automations table: id|name|enabled|run_count|next_run_at|last_run_at"
sqlite3 "$DB" "select id, name, enabled, run_count, datetime(next_run_at/1000,'unixepoch'), datetime(last_run_at/1000,'unixepoch') from automations where project_id='$PROJ';"
echo "--- automation_runs for victim:"
sqlite3 "$DB" "select count(*) from automation_runs where automation_id='auto_2tapqsqr0-e';"
echo "--- automation_runs for healthy:"
sqlite3 "$DB" "select count(*) from automation_runs where automation_id='auto_xo4-cpsx1u8';"
date -u
