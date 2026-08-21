#!/bin/zsh
set -u
cd /Users/sawyerhood/.bb-machines/bee.getbb.app/checkouts/bb/.claude/worktrees/wf_21e66a79-f02-6
eval "$(scripts/bb-dev-app env)"
export PROJ=proj_yrtm5h4dj9
export DATA_DIR=/Users/sawyerhood/.bb-dev/bb-machines-bee.getbb.app-checkouts-bb-.claude-worktrees-wf_21e66a79-f02-6-ab8f5e53e59d
export LOG=/tmp/bb-reports/issues/2166/verify/live-cli.log
zsh /tmp/bb-reports/issues/2166/repro/live-repro.sh > /tmp/bb-reports/issues/2166/verify/live-repro-stdout.log 2>&1
echo "live-repro rc=$?"
