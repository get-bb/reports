#!/usr/bin/env bash
# Issue #1770 repro, step 3: compare the spawned worktree's HEAD with the local
# and remote refs. Usage: ./1770-inspect.sh <worktree path printed by bb thread show>
set -uo pipefail
WT="${1:?worktree path}"
echo "\$ git -C /tmp/1770-qa rev-parse main origin/main      # project checkout: local main / remote-tracking ref"
git -C /tmp/1770-qa rev-parse main origin/main
echo "\$ git -C /tmp/1770-remote.git rev-parse main          # what is actually on the remote"
git -C /tmp/1770-remote.git rev-parse main
echo "\$ git -C $WT rev-parse HEAD"
git -C "$WT" rev-parse HEAD
echo "\$ git -C $WT log --oneline"
git -C "$WT" log --oneline
echo "\$ ls $WT"
ls "$WT"
