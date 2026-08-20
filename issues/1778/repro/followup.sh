#!/usr/bin/env bash
set -euo pipefail
export BB_SERVER_URL=http://localhost:26548 BB_HOST_DAEMON_PORT=34548; unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_PROJECT_ID BB_THREAD_STORAGE
cd /home/sawyer/projects/bb/.claude/worktrees/wf_926b3193-f6c-14
PROMPT=$'Canonical block form (expected rendering) follows; reply only with ok.\n\n$$\nT_{\\text{appearance}\\rightarrow\\text{chunk}}\n\\approx73\\text{--}146\\text{ ms}\n$$\n\n## Content after the formula\n\n- This should remain a list item.\n- [This should remain a link](https://example.com).'
node packages/scripts/dist/commands/run-cli.js thread tell thr_x9gvs6bkf5 "$PROMPT" --json
