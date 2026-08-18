#!/usr/bin/env bash
# Step 1 of the repro: start the bb dev instance while `gh` cannot reach GitHub.
# scripts/bb-dev-app prepends BB_DEV_NODE_BIN_DIR to PATH before ~/.local/bin
# (where the real gh lives), so pointing it at the shim dir (which also holds a
# `node` symlink) makes the server's `gh` calls hit the shim.
set -euo pipefail
WT=/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-3
: > /tmp/bb-reports/issues/1758/repro/gh-calls.log
touch /tmp/bb-reports/issues/1758/repro/gh-offline          # gh is "offline" from now on
export BB_DEV_NODE_BIN_DIR=/tmp/bb-reports/issues/1758/repro/fakebin
cd "$WT"
scripts/bb-dev-app current
