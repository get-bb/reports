#!/usr/bin/env bash
# Usage: bash browser-thread-page-loads.sh <project id> <thread id> [port=18999]
# Requires: serve-prod-build.mjs listening on <port>, and `dev-browser` on PATH.
# Prints one JSON object (chunk fetch order + sizes) on stdout and saves a
# screenshot to ~/.dev-browser/tmp/1072-thread-page.png.
set -euo pipefail
proj="${1:?project id, e.g. proj_xxx}"; thr="${2:?thread id, e.g. thr_yyy}"; port="${3:-18999}"
url="http://127.0.0.1:${port}/projects/${proj}/threads/${thr}"
sed "s#__THREAD_URL__#${url}#" "$(dirname "$0")/browser-thread-page-loads.js" | dev-browser --headless --timeout 60
