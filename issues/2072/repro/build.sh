#!/bin/zsh
# Runs the dev CLI's `bb plugin build` against an isolated data dir.
export _ZO_DOCTOR=0
cd /tmp/bb-2072-scratch/bb-plugin-toasty || exit 1
rm -rf dist
BB_DATA_DIR=/tmp/bb-2072-data NODE_ENV=development node /Users/sawyerhood/.bb-machines/bee.getbb.app/checkouts/bb/.claude/worktrees/wf_21e66a79-f02-12/apps/cli/dist/index.js plugin build
echo "build exit=$?"
