#!/usr/bin/env bash
# Runs the #1529 repro prompt against the raw cursor-agent CLI (headless) and saves NDJSON.
# Outputs go to $OUT (default /tmp/bb1529-out) so re-runs do not clobber the
# archived evidence next to this script.
set -uo pipefail
REPRO="$(cd "$(dirname "$0")" && pwd)"
OUT="${OUT:-/tmp/bb1529-out}"; mkdir -p "$OUT"
bash "$REPRO/setup.sh"
cd /tmp/bb1529/base
timeout 420 cursor-agent -p --force --trust --sandbox disabled --output-format stream-json --workspace /tmp/bb1529/base "$(cat "$REPRO/prompt.txt")" \
  > "$OUT/cursor-run.ndjson" 2> "$OUT/cursor-run.stderr"
echo "cursor-agent exit=$?"
wc -l "$OUT/cursor-run.ndjson"
