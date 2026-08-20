#!/usr/bin/env bash
# Issue 2029, defect 1 (SDK trigger): when the committed dist/app.meta.json records a
# different SDK version than the host, the host rebuilds dist/app.* on load even though
# every dist file is NEWER than every source -- the reporter's mtime workaround cannot
# prevent this trigger. Run this right after the bb server was (re)started with the
# fixture's HEAD = "simulate artifact built with SDK 0.4.1" and dist touched newest.
set -u
WORKTREE="${BB_WORKTREE:?set BB_WORKTREE to your bb checkout (see step0-fixture-setup.sh)}"
CLI="${BB_CLI:-node $WORKTREE/packages/scripts/dist/commands/run-cli.js}"
LOG="${BB_DEV_LOG:-$("$WORKTREE/scripts/bb-dev-app" status 2>/dev/null | sed -n 's/^Logs: \([^,]*\).*/\1/p')}"
cd /tmp/bb2029-plugin
echo "== committed meta =="
git show HEAD:dist/app.meta.json | grep -E 'sdkVersion|bbVersion'
echo "== mtimes: every dist file newer than every source =="
stat -c '%y %n' src/app.tsx src/provider-marks.ts src/server.ts dist/app.js dist/app.css dist/app.meta.json dist/server.js | sort
echo "== bb plugin list =="
$CLI plugin list 2>&1 | grep -A1 '^collab-fixture'
echo "== git status / diff after the server loaded the plugin =="
git status --short
git diff
echo "== dist mtimes after load (server.js untouched) =="
stat -c '%y %n' dist/app.js dist/app.css dist/app.meta.json dist/server.js
echo "== server log =="
grep "rebuilding frontend bundle" "$LOG" | grep collab-fixture | tail -1
