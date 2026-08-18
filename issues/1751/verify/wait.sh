#!/usr/bin/env bash
export BB_SERVER_URL=http://localhost:24052 BB_HOST_DAEMON_PORT=32052 BB_PROJECT_ID=proj_t4qbxr2qqk
unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE BB_CLI
cd /home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-75
TID=$(curl -s "$BB_SERVER_URL/api/v1/threads?projectId=proj_t4qbxr2qqk" | python3 -c 'import sys,json;d=json.load(sys.stdin);d=d if isinstance(d,list) else d.get("threads",d.get("items",[]));print(d[0]["id"])')
echo THREAD=$TID
node packages/scripts/dist/commands/run-cli.js thread wait $TID --timeout 240
node packages/scripts/dist/commands/run-cli.js thread output $TID
