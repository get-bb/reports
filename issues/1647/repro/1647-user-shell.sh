#!/bin/bash
# Simulates a process bb did NOT start (e.g. the user's own terminal cd'd into
# the worktree, or an editor process) whose cwd is the worktree directory.
cd "$1" || exit 1
setsid sleep 4000 >/dev/null 2>&1 < /dev/null &
echo "user-shell-sleep pid $!"
