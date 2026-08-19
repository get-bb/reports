#!/usr/bin/env bash
# Start THIS worktree's dev instance with a temp-installed omp + bun on PATH so
# the host daemon auto-detects the `acp-omp` provider.
set -u
cd /home/sawyer/projects/bb/.claude/worktrees/wf_d5c47f31-487-1 || exit 1
export PATH=/tmp/bb-1918-omp/node_modules/.bin:/tmp/bb-1918-bun/bun-linux-x64:$PATH
export OMP_CONFIG_DIR=/tmp/bb-1918-omp/home
scripts/bb-dev-app current
