#!/usr/bin/env bash
export BB_SERVER_URL=http://localhost:23936 BB_HOST_DAEMON_PORT=31936 BB_PROJECT_ID=proj_zc3nk34k2u
unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE BB_CLI
cd /home/sawyer/projects/bb/.claude/worktrees/wf_6b6686dc-4c2-11
node packages/scripts/dist/commands/run-cli.js thread wait thr_n8fsq6yqc5 --timeout 240
node packages/scripts/dist/commands/run-cli.js thread output thr_n8fsq6yqc5
