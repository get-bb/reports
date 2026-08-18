#!/usr/bin/env bash
# Answer the orchestrator's pending question, then look at what it received.
export BB_SERVER_URL=http://localhost:21503
unset BB_ENVIRONMENT_ID BB_THREAD_STORAGE BB_PROJECT_ID BB_THREAD_ID
export BB_HOST_DAEMON_PORT=29503
ORCH=${ORCH:-thr_8sxctvqggx}
PINT=${PINT:-pint_j2q2fvn94u}
Q=${Q:-toolu_018yKePwKFHqCiwN7NKbuExk:question-1}
CLI="node packages/scripts/dist/commands/run-cli.js"

echo "\$ bb thread interactions answer $PINT $ORCH --choice \"$Q=$Q:option-1\""
$CLI thread interactions answer $PINT $ORCH --choice "$Q=$Q:option-1" 2>&1; echo "exit=$?"
sleep 30
echo; echo "\$ bb thread show $ORCH"
$CLI thread show $ORCH 2>&1 | head -4
echo; echo "\$ bb thread log $ORCH"
$CLI thread log $ORCH 2>&1
echo; echo "\$ bb thread queue list $ORCH"
$CLI thread queue list $ORCH 2>&1
