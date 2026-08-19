#!/usr/bin/env bash
# Verifier's copy of run-omp-drive.sh pointing at this verifier's worktree + omp install.
set -u
export PATH=$HOME/.bun/bin:$PATH
export OMP_CONFIG_DIR=/tmp/bb-1918-verify-omp/home
export HOME=/tmp/bb-1918-verify-omp/home
mkdir -p "$HOME"
WT=/home/sawyer/projects/bb/.claude/worktrees/wf_d5c47f31-487-9
TSX=file://$WT/node_modules/.pnpm/tsx@4.23.1/node_modules/tsx/dist/loader.mjs
ENTRY=${1:-$WT/packages/provider-bridge-protocol/src/bridge-worker-entry.ts}
exec timeout 90 node /tmp/bb-reports/issues/1918/repro/drive-acp-agent.mjs \
  /tmp/bb-1918-verify-omp/node_modules/.bin/omp acp -- \
  --conditions=source --import "$TSX" "$ENTRY" --mcp-stdio
