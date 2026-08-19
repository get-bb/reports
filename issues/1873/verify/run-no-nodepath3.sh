#!/bin/bash
unset NODE_PATH
cd /home/sawyer/projects/bb/.claude/worktrees/wf_d5c47f31-487-8/apps/host-daemon || exit 2
node napi-wrapper-coalesce-linux-fixed.cjs --local; echo "exit=$?"
node napi-wrapper-coalesce-linux-fixed.cjs; echo "exit=$?"
