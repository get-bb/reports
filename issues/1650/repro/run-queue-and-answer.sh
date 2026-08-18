#!/bin/bash
# Step 2 of the live repro: show that the explicit queue route accepts a message while blocked,
# then answer the question and watch what gets delivered. Args: <thread id> <interaction id>
export BB_SERVER_URL=http://localhost:21503
export BB_HOST_DAEMON_PORT=29503
export BB_PROJECT_ID=proj_dd42ck6esj
unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE
T=$1; I=$2
run() { echo "\$ $*"; "$@" 2>&1 | grep -v '^>' | grep -v "turbo\|Packages in\|Running build\|Remote caching\|Tasks:\|Cached:\|Time:\|^$"; echo "exit=${PIPESTATUS[0]}"; echo; }
run pnpm bb:dev thread queue create "$T" "worker report 4 (via bb thread queue create)"
run pnpm bb:dev thread queue list "$T"
run pnpm bb:dev thread interactions answer "$I" "$T" --choice "toolu_01MgLzD8SQt8wjK4WuonKcZa:question-1=toolu_01MgLzD8SQt8wjK4WuonKcZa:question-1:option-1"
sleep 40
run pnpm bb:dev thread queue list "$T"
run pnpm bb:dev thread log "$T"
