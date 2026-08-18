#!/usr/bin/env bash
DB=/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_debcf606-e4a-33-4322b8038a31/bb.db
WT=/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_debcf606-e4a-33-4322b8038a31/worktrees/env_ig2nscwucq
until [ "$(sqlite3 $DB "select status from environments where id='env_ig2nscwucq';")" = "destroyed" ]; do sleep 5; done
echo "destroyed at $(date +%s)"
sqlite3 $DB "select id,status,path,retire_requested_at from environments where id='env_ig2nscwucq';"
ls "$WT" 2>&1
echo "--- procs rooted in worktree after destroy"
/tmp/bb-reports/issues/1660/repro/find-worktree-procs.sh "$WT"
echo "--- ps"
ps -o pid,ppid,pgid,sid,stat,etime,cmd -p 1591658,1591676,1593823 2>&1
