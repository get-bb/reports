#!/usr/bin/env bash
# Spawn a tiny codex turn against the pressured bb instance and record what the CLI sees.
# Pass --model to skip provider model resolution (which already fails with a 503 under pressure)
# so the thread is actually created and we can watch what happens to the turn.
export BB_SERVER_URL=http://127.0.0.1:41334
BB=/home/sawyer/projects/bb/.claude/worktrees/wf_debcf606-e4a-18/packages/bb-app/dist/bb.js
echo "start $(date +%T)"
timeout 300 node "$BB" thread spawn --project proj_fztrbbmudf --environment /tmp/bb1334/qa-repo \
  --machine host_t837j6yaea --provider codex "$@" --prompt "Reply only with ok." --json
echo "rc=$? end $(date +%T)"
