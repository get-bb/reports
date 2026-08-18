#!/usr/bin/env bash
# Proof that setup-harness.sh works from nothing: build a second, independent harness
# (own npm deps, own Playwright browser cache) and log it. Nothing under
# /tmp/bb-1603-wk or ~/.cache/ms-playwright is touched.
# Usage: bash setup-harness-fresh-test.sh [dir=/tmp/bb-1603-wk-fresh]
FRESH=${1:-/tmp/bb-1603-wk-fresh}
LOG=/tmp/bb-reports/issues/1603/setup-harness-fresh.log
mkdir -p "$FRESH/browsers"
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
{
  echo "start $(date -Is)"
  time BB1603_HARNESS=$FRESH PLAYWRIGHT_BROWSERS_PATH=$FRESH/browsers bash "$HERE/setup-harness.sh"
  echo "exit=$? end $(date -Is)"
  du -sh "$FRESH"
} > "$LOG" 2>&1
tail -5 "$LOG"
