#!/usr/bin/env bash
# Issue 2029, defect 1: a path install rewrites the plugin's committed dist/app.* in place.
# Prereqs: a dev bb instance (BB_SERVER_URL exported), fixture repo at /tmp/bb2029-plugin
# with dist/ built by `bb plugin build` and committed (git status clean).
set -u
WORKTREE="${BB_WORKTREE:?set BB_WORKTREE to your bb checkout (see step0-fixture-setup.sh)}"
CLI="${BB_CLI:-node $WORKTREE/packages/scripts/dist/commands/run-cli.js}"
cd /tmp/bb2029-plugin
echo "== before install: git status --short (empty = clean) =="
git status --short
echo "== dist mtimes before =="
ls -la --time-style=full-iso dist | grep -E 'app|server'
echo "== bb plugin install /tmp/bb2029-plugin --yes =="
$CLI plugin install /tmp/bb2029-plugin --yes 2>&1
echo "== after install: git status --short =="
git status --short
echo "== git diff =="
git diff
echo "== dist mtimes after =="
ls -la --time-style=full-iso dist | grep -E 'app|server'
