#!/bin/bash
cd /home/sawyer/projects/bb/.claude/worktrees/wf_570fde41-63f-7
echo "# outer shell: BB_HOST_DAEMON_PORT=${BB_HOST_DAEMON_PORT:-<unset>}"
echo '$ BB_SERVER_URL=http://localhost:25792 pnpm bb:dev thread spawn --project proj_uzvv6df4kw --provider codex --permission-mode accept-edits --title "1615 qa" --prompt "Reply only with ok." --json'
BB_SERVER_URL=http://localhost:25792 pnpm bb:dev thread spawn --project proj_uzvv6df4kw --provider codex --permission-mode accept-edits --title "1615 qa" --prompt "Reply only with ok." --json 2>&1 | grep -v "^>" | head -20
echo
echo '$ eval "$(scripts/bb-dev-app env)"   # sets BB_SERVER_URL and BB_HOST_DAEMON_PORT for THIS instance'
eval "$(scripts/bb-dev-app env)"
echo "# now BB_SERVER_URL=$BB_SERVER_URL BB_HOST_DAEMON_PORT=$BB_HOST_DAEMON_PORT"
echo '$ pnpm bb:dev thread spawn --project proj_uzvv6df4kw --provider codex --permission-mode accept-edits --title "1615 qa" --prompt "Reply only with ok." --json'
pnpm bb:dev thread spawn --project proj_uzvv6df4kw --provider codex --permission-mode accept-edits --title "1615 qa" --prompt "Reply only with ok." --json 2>&1 | grep -v "^>" | head -30
