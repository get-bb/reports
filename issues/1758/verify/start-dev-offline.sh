#!/usr/bin/env bash
set -euo pipefail
V=/tmp/bb-reports/issues/1758/verify
WT=/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-58
: > $V/gh-calls.log
touch $V/gh-offline
export BB_DEV_NODE_BIN_DIR=$V/fakebin
cd "$WT"
scripts/bb-dev-app current
