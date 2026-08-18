#!/usr/bin/env bash
# Spawn N idle codex sibling threads in the qa project. Prints their ids.
# Usage: 1302-spawn-siblings.sh <project id> <host id> <count>
set -euo pipefail
BB="$(dirname "$0")/1302-bb.sh"
PROJECT="$1"; HOST="$2"; COUNT="${3:-2}"
for i in $(seq 1 "$COUNT"); do
  "$BB" thread spawn --project "$PROJECT" --machine "$HOST" --provider codex \
    --permission-mode accept-edits --title "1302 sibling $i" \
    --prompt "Reply only with ok." --json | jq -r .id
done
