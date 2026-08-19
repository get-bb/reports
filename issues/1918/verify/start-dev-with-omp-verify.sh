#!/usr/bin/env bash
set -u
cd /home/sawyer/projects/bb/.claude/worktrees/wf_d5c47f31-487-9 || exit 1
export PATH=/tmp/bb-1918-verify-omp/node_modules/.bin:$HOME/.bun/bin:$PATH
export OMP_CONFIG_DIR=/tmp/bb-1918-verify-omp/home
scripts/bb-dev-app current
