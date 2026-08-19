#!/bin/bash
unset NODE_PATH
cd /home/sawyer/projects/bb/.claude/worktrees/wf_d5c47f31-487-8/apps/host-daemon || exit 2
ls node_modules/@parcel 2>&1
node -e 'console.log(require.resolve("@parcel/watcher"))'
node -e 'const {createRequire}=require("module"); const r=createRequire(require.resolve("@parcel/watcher")); console.log(r.resolve("@parcel/watcher-linux-x64-glibc/watcher.node"))'
echo "--- 4b without NODE_PATH (fixed tree currently applied)"
node --require ./log-dlopen.cjs dist/daemon-bundle.mjs --definitely-not-a-flag 2>&1 | grep -E '^\[dlopen|^\[exit'
