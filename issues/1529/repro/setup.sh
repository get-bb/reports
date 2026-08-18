#!/usr/bin/env bash
# Creates a scratch git repo with one worktree for the #1529 repro.
set -euo pipefail
rm -rf /tmp/bb1529
mkdir -p /tmp/bb1529/base
cd /tmp/bb1529/base
git init -q -b main
git -c user.email=qa@example.com -c user.name=qa commit -q --allow-empty -m init
git worktree add -q /tmp/bb1529/wt -b wt
echo "base=/tmp/bb1529/base worktree=/tmp/bb1529/wt"
