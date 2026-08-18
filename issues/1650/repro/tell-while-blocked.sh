#!/usr/bin/env bash
# Run from the bb repo root with the dev instance up.
# ORCH = thread blocked on AskUserQuestion, WORKER = child thread that "sends".
export BB_SERVER_URL=http://localhost:21503
unset BB_ENVIRONMENT_ID BB_THREAD_STORAGE BB_PROJECT_ID
export BB_HOST_DAEMON_PORT=29503
ORCH=${ORCH:-thr_8sxctvqggx}
WORKER=${WORKER:-thr_qq5x7cp3m5}
CLI="node packages/scripts/dist/commands/run-cli.js"
export BB_THREAD_ID=$WORKER

echo "\$ BB_THREAD_ID=$WORKER bb thread tell $ORCH \"Worker report #1: task done.\""
$CLI thread tell $ORCH "Worker report #1: task done." 2>&1; echo "exit=$?"; echo
echo "\$ BB_THREAD_ID=$WORKER bb thread tell --mode queue $ORCH \"Worker report #2 (queue mode).\""
$CLI thread tell --mode queue $ORCH "Worker report #2 (queue mode)." 2>&1; echo "exit=$?"; echo
echo "\$ BB_THREAD_ID=$WORKER bb thread tell --mode auto $ORCH \"Worker report #3 (auto mode).\""
$CLI thread tell --mode auto $ORCH "Worker report #3 (auto mode)." 2>&1; echo "exit=$?"; echo
echo "\$ bb thread queue list $ORCH   # recipient-side queue"
$CLI thread queue list $ORCH 2>&1; echo "exit=$?"; echo
echo "\$ bb thread show $ORCH   # recipient-side view: no hint that anything was addressed to it"
$CLI thread show $ORCH 2>&1; echo "exit=$?"
