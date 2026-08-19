#!/usr/bin/env bash
# Drive a locally-installed omp (oh-my-pi, under /tmp/bb-1918-omp, run with a
# temp bun) over ACP with the given bb-bridge MCP server entry.
# usage: run-omp-drive.sh <mcp entry path> [extra node args...]
set -u
export PATH=/tmp/bb-1918-bun/bun-linux-x64:$PATH
export OMP_CONFIG_DIR=/tmp/bb-1918-omp/home
export HOME=/tmp/bb-1918-omp/home
mkdir -p "$HOME"
WT=/home/sawyer/projects/bb/.claude/worktrees/wf_d5c47f31-487-1
TSX=file://$WT/node_modules/.pnpm/tsx@4.23.1/node_modules/tsx/dist/loader.mjs
ENTRY=${1:-$WT/packages/provider-bridge-protocol/src/bridge-worker-entry.ts}
exec timeout 90 node /tmp/bb-reports/issues/1918/repro/drive-acp-agent.mjs \
  /tmp/bb-1918-omp/node_modules/.bin/omp acp -- \
  --conditions=source --import "$TSX" "$ENTRY" --mcp-stdio
