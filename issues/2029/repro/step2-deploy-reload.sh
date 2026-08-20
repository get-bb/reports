#!/usr/bin/env bash
# Issue 2029, defect 1: a deploy-by-git-checkout followed by `bb plugin reload`
# rebuilds dist/app.* inside the deployed checkout.
# Prereqs: step1 ran (plugin installed from /tmp/bb2029-plugin).
set -u
CLI="${BB_CLI:-node /home/sawyer/projects/bb/.claude/worktrees/wf_926b3193-f6c-4/packages/scripts/dist/commands/run-cli.js}"
cd /tmp/bb2029-plugin
git checkout -q -- dist              # restore committed bytes (install rewrote app.meta.json)
V1=$(git rev-parse --short HEAD)

echo "== author a new version: edit src/provider-marks.ts, bb plugin build, commit (v2) =="
sed -i 's/provider-mark-v1/provider-mark-v2/' src/provider-marks.ts
$CLI plugin build /tmp/bb2029-plugin >/dev/null 2>&1
git add -A && git -c user.email=qa@example.com -c user.name=qa commit -qm "v2: new mark + rebuilt dist"
V2=$(git rev-parse --short HEAD)
echo "v1=$V1 v2=$V2"

echo "== deploy: git checkout v1, then git checkout v2 (what a deploy does on the host) =="
git checkout -q "$V1" && sleep 1 && git checkout -q "$V2"
echo "== git status after checkout (clean) =="
git status --short
echo "== mtimes after checkout: git writes files in index order, dist/ before src/ =="
stat -c '%y %n' dist/app.js src/app.tsx src/provider-marks.ts src/server.ts
echo "== sha256 of committed dist before reload =="
sha256sum dist/app.js dist/app.css dist/app.meta.json

echo "== bb plugin reload collab-fixture =="
$CLI plugin reload collab-fixture 2>&1
echo "exit=$?"
sleep 1
echo "== git status after reload =="
git status --short
echo "== git diff after reload =="
git diff
echo "== mtimes after reload =="
stat -c '%y %n' dist/app.js dist/app.css dist/app.meta.json dist/server.js
echo "== sha256 after reload =="
sha256sum dist/app.js dist/app.css dist/app.meta.json
