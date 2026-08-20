#!/usr/bin/env bash
# Issue 2029, defect 1 (load path): `bb plugin reload` rebuilds dist/app.* inside the
# plugin root when (a) any source mtime is newer than dist/app.js, or (b) the
# committed dist/app.meta.json records a different SDK version than the host --
# the reporter's mtime workaround does not cover (b).
# Prereqs: fresh server (no hung service), fixture installed and "running", git clean.
set -u
CLI="${BB_CLI:-node /home/sawyer/projects/bb/.claude/worktrees/wf_926b3193-f6c-4/packages/scripts/dist/commands/run-cli.js}"
LOG="${BB_DEV_LOG:-/home/sawyer/.bb-dev/launchers/projects-bb-.claude-worktrees-wf_926b3193-f6c-4/dev.log}"
cd /tmp/bb2029-plugin
git checkout -q -- dist
echo "== (a) source newer than dist/app.js: touch src/provider-marks.ts, then reload =="
git status --short; echo "(git clean above)"
stat -c '%y %n' dist/app.js
touch src/provider-marks.ts
stat -c '%y %n' src/provider-marks.ts
$CLI plugin reload collab-fixture 2>&1 | head -1
echo "-- dist mtimes after reload --"
stat -c '%y %n' dist/app.js dist/app.css dist/app.meta.json
echo "-- git status / diff after reload --"
git status --short
git diff
grep "rebuilding frontend bundle" "$LOG" | grep collab-fixture | tail -1

echo
echo "== (b) committed meta says another SDK version; dist mtimes are NEWER than every source =="
git checkout -q -- dist
sed -i 's/"sdkVersion": "[0-9.]*"/"sdkVersion": "0.4.1"/' dist/app.meta.json
git -c user.email=qa@example.com -c user.name=qa commit -qam "simulate artifact built with SDK 0.4.1"
touch dist/app.js dist/app.css dist/app.meta.json
echo "-- newest source vs dist/app.js --"
stat -c '%y %n' src/app.tsx src/provider-marks.ts src/server.ts dist/app.js | sort
git status --short; echo "(git clean above)"
$CLI plugin reload collab-fixture 2>&1 | head -1
echo "-- git status / diff after reload --"
git status --short
git diff
grep "rebuilding frontend bundle" "$LOG" | grep collab-fixture | tail -1
