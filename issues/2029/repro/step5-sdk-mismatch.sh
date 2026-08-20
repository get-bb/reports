#!/usr/bin/env bash
# Issue 2029, defect 1 (SDK trigger): when the committed dist/app.meta.json records a
# different SDK version than the host, the host rebuilds dist/app.* on load even though
# every dist file is NEWER than every source -- the reporter's mtime workaround cannot
# prevent this trigger. Run this right after the bb server was (re)started with the
# fixture's HEAD = "simulate artifact built with SDK 0.4.1" and dist touched newest.
set -u
CLI="${BB_CLI:-node /home/sawyer/projects/bb/.claude/worktrees/wf_926b3193-f6c-4/packages/scripts/dist/commands/run-cli.js}"
LOG="${BB_DEV_LOG:-/home/sawyer/.bb-dev/launchers/projects-bb-.claude-worktrees-wf_926b3193-f6c-4/dev.log}"
cd /tmp/bb2029-plugin
echo "== committed meta =="
git show HEAD:dist/app.meta.json | grep -E 'sdkVersion|bbVersion'
echo "== mtimes: every dist file newer than every source =="
stat -c '%y %n' src/app.tsx src/provider-marks.ts src/server.ts dist/app.js dist/app.css dist/app.meta.json | sort
echo "== bb plugin list =="
$CLI plugin list 2>&1 | grep -A1 '^collab-fixture'
echo "== git status / diff after the server loaded the plugin =="
git status --short
git diff
echo "== server log =="
grep "rebuilding frontend bundle" "$LOG" | grep collab-fixture | tail -1
