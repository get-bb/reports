#!/usr/bin/env bash
# Usage: APP=http://localhost:APPPORT PROJECT=proj_x THREAD=thr_y THREAD_TITLE="1303 target" ./1303-run-count.sh
# Requires the `dev-browser` CLI (npm i -g dev-browser && dev-browser install).
set -eu
DIR=$(dirname "$0")
sed -e "s#__APP__#${APP:?}#; s#__PROJECT__#${PROJECT:?}#; s#__THREAD_TITLE__#${THREAD_TITLE:?}#; s#__THREAD__#${THREAD:?}#" \
  "$DIR/1303-count-requests.js" > "$DIR/1303-count-requests.local.js"
dev-browser --headless --timeout 150 run "$DIR/1303-count-requests.local.js"
