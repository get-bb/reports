#!/usr/bin/env bash
# Step 3 of the repro: >6 minutes after gh came back (one full 5-minute sync
# interval has passed), show that the plugin never re-probed and is still
# needs-configuration; then show that `bb plugin reload github` fixes it.
target=${1:-07:30:40}
until [ "$(date +%s)" -ge "$(date -d "$target" +%s)" ]; do sleep 5; done
echo "== $(date +%T) =="
echo "-- gh calls made by the server process since start (shim log):"
cat /tmp/bb-reports/issues/1758/repro/gh-calls.log
echo "-- gh works right now:"
/home/sawyer/.local/bin/gh auth status 2>&1 | head -2
echo "-- bb plugin list:"
bash /tmp/bb-reports/issues/1758/repro/bb.sh plugin list 2>&1 | grep -A3 "^github"
echo "-- plugin status RPC (what the panel banner would read):"
curl -s -X POST http://localhost:23580/api/v1/plugins/github/rpc/status -H 'content-type: application/json' -H 'origin: http://localhost:15580' -d 'null'; echo
echo "-- server log lines about github:"
grep -n "plugin:github\|plugin github" /home/sawyer/.bb-dev/launchers/projects-bb-.claude-worktrees-wf_242c3e11-a10-3/dev.log
