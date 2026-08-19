#!/usr/bin/env bash
# Runs the 1914 repro workflow from inside the origin thread's workspace.
#   run-workflow.sh <origin-thread-id> <environment-id> <project-id> [validate|run|status <run>|history <run>]
set -euo pipefail
ORIGIN_THREAD="$1"; ENV_ID="$2"; PROJECT_ID="$3"; shift 3
export BB_SERVER_URL=http://localhost:19386
export BB_HOST_DAEMON_PORT=27386
export BB_PROJECT_ID="$PROJECT_ID"
export BB_THREAD_ID="$ORIGIN_THREAD"
export BB_ENVIRONMENT_ID="$ENV_ID"
cp /tmp/bb-reports/issues/1914/repro/collect.workflow.js /tmp/bb-1914/qa-repo/collect.workflow.js
cd /tmp/bb-1914/qa-repo
CLI=/home/sawyer/projects/bb/.claude/worktrees/wf_d5c47f31-487-6/packages/scripts/dist/commands/run-cli.js
case "${1:-run}" in
  validate) exec node "$CLI" workflows validate --file /tmp/bb-1914/qa-repo/collect.workflow.js ;;
  run)      exec node "$CLI" workflows run --file /tmp/bb-1914/qa-repo/collect.workflow.js ;;
  status)   exec node "$CLI" workflows status "$2" ;;
  history)  exec node "$CLI" workflows history "$2" ;;
  *)        exec node "$CLI" workflows "$@" ;;
esac
