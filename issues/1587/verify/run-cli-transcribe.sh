#!/usr/bin/env bash
# Run `bb voice transcribe` against the dev instance started from the worktree
# with NODE_OPTIONS="--import cf-challenge-preload.mjs".
#   ./run-cli-transcribe.sh baseline   -> real network (flag file removed)
#   ./run-cli-transcribe.sh challenge  -> simulated Cloudflare challenge
set -u
WORKTREE=/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-64
HERE=/tmp/bb-reports/issues/1587/verify
export BB_SERVER_URL=http://localhost:23860 BB_HOST_DAEMON_PORT=31860 BB_PROJECT_ID=proj_personal
unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE NODE_OPTIONS
mode=${1:-baseline}
if [[ "$mode" == "challenge" ]]; then touch "$HERE/FORCE_CF_CHALLENGE"; else rm -f "$HERE/FORCE_CF_CHALLENGE"; fi
rm -f "$HERE/cf-challenge-preload.log"
echo "\$ bb voice transcribe tone.mp3 --type audio/mpeg   # mode=$mode"
node "$WORKTREE/packages/scripts/dist/commands/run-cli.js" voice transcribe /tmp/bb-reports/issues/1587/repro/tone.mp3 --type audio/mpeg
echo "exit=$?"
if [[ -f "$HERE/cf-challenge-preload.log" ]]; then
  echo "--- daemon fetch calls intercepted by the preload:"
  cat "$HERE/cf-challenge-preload.log"
fi
