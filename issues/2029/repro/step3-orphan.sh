#!/usr/bin/env bash
# Issue 2029, defect 2: `bb plugin reload` of a plugin whose background service
# ignores its abort signal leaves the plugin unloaded (degraded), its CLI command
# gone, the orphaned service ticking on a closed database handle -- and the CLI
# still exits 0.
# Prereqs: fixture installed from /tmp/bb2029-plugin and currently "running".
set -u
WORKTREE="${BB_WORKTREE:?set BB_WORKTREE to your bb checkout (see step0-fixture-setup.sh)}"
CLI="${BB_CLI:-node $WORKTREE/packages/scripts/dist/commands/run-cli.js}"
LOG="${BB_DEV_LOG:-$("$WORKTREE/scripts/bb-dev-app" status 2>/dev/null | sed -n 's/^Logs: \([^,]*\).*/\1/p')}"
echo "== before: bb plugin list (collab-fixture) =="
$CLI plugin list 2>&1 | grep -A3 '^collab-fixture'
echo "== before: bb collab =="
$CLI collab 2>&1; echo "exit=$?"

echo "== bb plugin reload collab-fixture =="
$CLI plugin reload collab-fixture 2>&1
echo "exit=$?"
echo "== bb plugin reload --json collab-fixture (ok flag) =="
$CLI plugin reload --json collab-fixture 2>&1 | head -c 400; echo
echo "exit=$?"

echo "== after: bb plugin list (collab-fixture) =="
$CLI plugin list 2>&1 | grep -A3 '^collab-fixture'
echo "== after: bb collab =="
$CLI collab 2>&1; echo "exit=$?"
echo "== after: bb plugin run collab-fixture =="
$CLI plugin run collab-fixture 2>&1; echo "exit=$?"

sleep 5
echo "== plugin log (bb plugin logs collab-fixture, last 3) =="
$CLI plugin logs collab-fixture 2>&1 | tail -3
echo "== count of 'database connection is not open' lines =="
$CLI plugin logs collab-fixture 2>&1 | grep -c "database connection is not open"
echo "== server log lines for collab-fixture =="
grep "collab-fixture" "$LOG" | grep -v "capacity-interval" | tail -4

echo "== disable + enable =="
$CLI plugin disable collab-fixture 2>&1; echo "exit=$?"
$CLI plugin enable collab-fixture 2>&1; echo "exit=$?"
sleep 3
echo "== after enable: count of 'database connection is not open' lines (still growing?) =="
$CLI plugin logs collab-fixture 2>&1 | grep -c "database connection is not open"
sleep 3
$CLI plugin logs collab-fixture 2>&1 | grep -c "database connection is not open"
