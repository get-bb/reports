#!/bin/zsh
set -u
cd /Users/sawyerhood/.bb-machines/bee.getbb.app/checkouts/bb/.claude/worktrees/wf_21e66a79-f02-6
eval "$(scripts/bb-dev-app env)"
PROJ=proj_yrtm5h4dj9
DB=/Users/sawyerhood/.bb-dev/bb-machines-bee.getbb.app-checkouts-bb-.claude-worktrees-wf_21e66a79-f02-6-ab8f5e53e59d/plugins/automations/data.db
for id in auto_2tapqsqr0-e auto_7v8rqgiqcf4 auto_xo4-cpsx1u8; do
  pnpm bb:dev automation pause $id --project $PROJ 2>&1 | grep -i paused
done
sqlite3 "$DB" "select id, name, enabled, run_count from automations where project_id='$PROJ';"
echo "--- runs for victim:"
sqlite3 -header "$DB" "select id, automation_id, status, datetime(started_at/1000,'unixepoch') started, datetime(finished_at/1000,'unixepoch') finished, substr(coalesce(error,''),1,120) err from automation_runs where automation_id='auto_2tapqsqr0-e';"
echo "--- server log lines mentioning victim after repair:"
grep -n "auto_2tapqsqr0-e" /Users/sawyerhood/.bb-dev/launchers/bb-machines-bee.getbb.app-checkouts-bb-.claude-worktrees-wf_21e66a79-f02-6/dev.log | grep -v "invalid stored configuration" | tail -8 | cut -c1-220
