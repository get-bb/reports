#!/bin/zsh
WT=/Users/sawyerhood/.bb-machines/bee.getbb.app/checkouts/bb/.claude/worktrees/wf_21e66a79-f02-6
cd $WT
scripts/bb-dev-app status 2>&1 | grep -E "Data dir|Dev session|Desktop session"
sleep 2
pkill -f "$WT" && echo "pkilled leftovers" || echo "no leftover processes"
DATA=/Users/sawyerhood/.bb-dev/bb-machines-bee.getbb.app-checkouts-bb-.claude-worktrees-wf_21e66a79-f02-6-ab8f5e53e59d
case "$DATA" in /Users/sawyerhood/.bb-dev/*wf_21e66a79-f02-6*) rm -rf "$DATA" && echo "removed $DATA";; esac
rm -rf /tmp/bb-2166-verify-repo /tmp/bb-2166-prompt.md /tmp/bb-2166-rpc.out /tmp/bb-2166-verify-get.out /tmp/bb-2166-verify-list.out /tmp/bb-2166-verify-ov.out
echo "--- listening on my ports (expect none):"
lsof -nP -iTCP:14731 -iTCP:22731 -iTCP:30731 -sTCP:LISTEN || echo "ports 14731/22731/30731 free"
echo "--- processes referencing worktree (expect none):"
pgrep -fl "$WT" || echo none
