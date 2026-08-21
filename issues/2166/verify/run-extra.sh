#!/bin/zsh
set -u
cd /Users/sawyerhood/.bb-machines/bee.getbb.app/checkouts/bb/.claude/worktrees/wf_21e66a79-f02-6
eval "$(scripts/bb-dev-app env)"
export PROJ=proj_yrtm5h4dj9
export HEALTHY=auto_xo4-cpsx1u8
export DATA_DIR=/Users/sawyerhood/.bb-dev/bb-machines-bee.getbb.app-checkouts-bb-.claude-worktrees-wf_21e66a79-f02-6-ab8f5e53e59d
LOG=/tmp/bb-reports/issues/2166/verify/live-create.log zsh /tmp/bb-reports/issues/2166/repro/live-create.sh > /dev/null 2>&1
echo "create rc=$?"
grep -vE "^\s+\"(origin|inclusive|maximum)\"|^\s+\]|^\s+\[|^\s+\}|^\s+\{|ELIFECYCLE|^$|zzzzzzzz|turbo|Packages|Running|Remote|Tasks|Cached|Time|cross-env|bb@" /tmp/bb-reports/issues/2166/verify/live-create.log | cut -c1-160
echo "=============== rpc contrast"
LOG=/tmp/bb-reports/issues/2166/verify/rpc-contrast.log zsh /tmp/bb-reports/issues/2166/repro/rpc-contrast.sh
