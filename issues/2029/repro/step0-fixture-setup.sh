#!/usr/bin/env bash
# Issue 2029, step 0: assemble the fixture plugin at /tmp/bb2029-plugin, build dist/ with
# `bb plugin build`, and commit everything so `git status` is the integrity check.
#
# Every step script reads:
#   BB_WORKTREE  - your bb monorepo checkout (the one whose `scripts/bb-dev-app current` is running)
#   BB_CLI       - optional override, default: node $BB_WORKTREE/packages/scripts/dist/commands/run-cli.js
#   BB_DEV_LOG   - optional override, default: the dev.log printed by `$BB_WORKTREE/scripts/bb-dev-app status`
# plus BB_SERVER_URL etc. from `eval "$($BB_WORKTREE/scripts/bb-dev-app env)"`.
set -eu
WORKTREE="${BB_WORKTREE:?set BB_WORKTREE to your bb checkout}"
CLI="${BB_CLI:-node $WORKTREE/packages/scripts/dist/commands/run-cli.js}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # this repro directory (fixture-* files live here)
P=/tmp/bb2029-plugin

rm -rf "$P"
mkdir -p "$P/src"
cp "$HERE/fixture-package.json"       "$P/package.json"
cp "$HERE/fixture-server.ts"          "$P/src/server.ts"
cp "$HERE/fixture-app.tsx"            "$P/src/app.tsx"
cp "$HERE/fixture-provider-marks.ts"  "$P/src/provider-marks.ts"   # says provider-mark-v1; step 2 bumps it to v2
grep -q 'provider-mark-v1' "$P/src/provider-marks.ts"
cd "$P"
git init -q
printf 'node_modules/\n' > .gitignore
echo "== bb plugin build $P =="
$CLI plugin build "$P" 2>&1
echo "== dist contents =="
ls -la --time-style=full-iso dist
git add -A
git -c user.email=qa@example.com -c user.name=qa commit -qm "v1: fixture with committed dist"
echo "== committed (git status --short must be empty) =="
git status --short
git log --oneline
