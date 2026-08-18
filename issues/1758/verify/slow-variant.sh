#!/usr/bin/env bash
V=/tmp/bb-reports/issues/1758/verify
touch $V/gh-slow
date +%T
bash $V/bb.sh plugin reload github 2>&1 | grep -A4 "^github"
date +%T
rm -f $V/gh-slow
curl -s -X POST http://localhost:23569/api/v1/plugins/github/rpc/status -H 'content-type: application/json' -H 'origin: http://localhost:15569' -d 'null'; echo
sleep 20
echo "-- gh calls (tail):"; tail -4 $V/gh-calls.log
echo "-- dev.log github lines:"; grep -n "plugin:github\|plugin github" /home/sawyer/.bb-dev/launchers/projects-bb-.claude-worktrees-wf_242c3e11-a10-58/dev.log | tail -6
bash $V/bb.sh plugin list 2>&1 | grep -A3 "^github"
