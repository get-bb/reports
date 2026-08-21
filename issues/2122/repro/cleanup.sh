#!/bin/bash
# Cleanup for the #2122 investigation: kill leftover processes from the worktree,
# delete the dev data dir and scratch repo, and confirm the ports are free.
WT="/Users/sawyerhood/.bb-machines/bee.getbb.app/checkouts/bb/.claude/worktrees/wf_21e66a79-f02-4"
DD="/Users/sawyerhood/.bb-dev/bb-machines-bee.getbb.app-checkouts-bb-.claude-worktrees-wf_21e66a79-f02-4-66591f607d02"
pkill -f "$WT" 2>/dev/null
sleep 2
echo "remaining processes mentioning worktree:"; pgrep -fl "$WT" | grep -v cleanup.sh | head
case "$DD" in /Users/sawyerhood/.bb-dev/*wf_21e66a79-f02-4*) rm -rf "$DD"; echo "removed $DD";; esac
rm -rf /tmp/bb-2122-qa /tmp/bb-2122-stash
echo "listening on our ports (15768 23768 31768):"
lsof -nP -iTCP:15768 -iTCP:23768 -iTCP:31768 -sTCP:LISTEN 2>/dev/null || echo "(none)"
ls -d "$DD" 2>/dev/null || echo "data dir gone"
