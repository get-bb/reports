#!/usr/bin/env bash
V=/tmp/bb-reports/issues/1758/verify
target=${1:-08:30:45}
until [ "$(date +%s)" -ge "$(date -d "$target" +%s)" ]; do sleep 5; done
echo "== $(date +%T) =="
echo "-- gh calls made by the server process since start (shim log):"
cat $V/gh-calls.log
echo "-- gh works right now:"
/home/sawyer/.local/bin/gh auth status 2>&1 | head -2
echo "-- bb plugin list:"
bash $V/bb.sh plugin list 2>&1 | grep -A3 "^github"
echo "-- plugin status RPC:"
curl -s -X POST http://localhost:23569/api/v1/plugins/github/rpc/status -H 'content-type: application/json' -H 'origin: http://localhost:15569' -d 'null'; echo
echo "-- server log lines about github:"
grep -n "plugin:github\|plugin github" /home/sawyer/.bb-dev/launchers/projects-bb-.claude-worktrees-wf_242c3e11-a10-58/dev.log
