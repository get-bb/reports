#!/usr/bin/env bash
set -euo pipefail
D="$(dirname "$0")"
for id in "$@"; do "$D/bb.sh" thread tell "$id" "Reply only with ok." & done
wait
sleep 3
BB_SERVER_URL=http://localhost:20041 "$D/../repro/1302-wait-idle.sh" "$@"
