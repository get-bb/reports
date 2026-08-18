#!/usr/bin/env bash
# Send "Reply only with ok." to several threads at once, then wait for idle.
# Usage: 1302-tell-concurrent.sh <thread id>...   (targets your dev instance via 1302-bb.sh / 1302-wait-idle.sh)
set -euo pipefail
BB="$(dirname "$0")/1302-bb.sh"
date -u +%T
for id in "$@"; do
  "$BB" thread tell "$id" "Reply only with ok." &
done
wait
sleep 3
"$(dirname "$0")/1302-wait-idle.sh" "$@"
date -u +%T
