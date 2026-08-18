#!/usr/bin/env bash
# PR #1698's CLI (apps/cli/dist built from pr-1698) against the running dev server.
export BB_SERVER_URL=http://localhost:21503
unset BB_ENVIRONMENT_ID BB_THREAD_STORAGE BB_PROJECT_ID BB_THREAD_ID BB_CLI
export BB_HOST_DAEMON_PORT=29503
ORCH=${ORCH:-thr_e3y3grkpyy}
CLI="node apps/cli/dist-pr1698/index.js"

echo "\$ bb thread wait $ORCH --until-input --timeout 90"
$CLI thread wait $ORCH --until-input --timeout 90 2>&1; echo "exit=$?"; echo
echo "\$ bb thread show $ORCH"
$CLI thread show $ORCH 2>&1; echo "exit=$?"; echo
echo "\$ bb thread list --project proj_dd42ck6esj"
$CLI thread list --project proj_dd42ck6esj 2>&1 | head -8; echo
echo "\$ bb thread tell $ORCH 'hello'   # (server is still base main; PR 1698's server-side 409 text is not deployed here)"
$CLI thread tell $ORCH "hello" 2>&1; echo "exit=$?"; echo
echo "\$ bb thread wait $ORCH --until-input --timeout 5   # already pending: returns immediately"
$CLI thread wait $ORCH --until-input --timeout 5 --json 2>&1 | head -20; echo "exit=$?"
