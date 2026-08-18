#!/usr/bin/env bash
# Runs the #1529 repro prompt against the raw pi CLI (headless, json mode) as a
# cross-provider control. Outputs go to $OUT (default /tmp/bb1529-out).
set -uo pipefail
REPRO="$(cd "$(dirname "$0")" && pwd)"
OUT="${OUT:-/tmp/bb1529-out}"; mkdir -p "$OUT"
bash "$REPRO/setup.sh"
cd /tmp/bb1529/base
timeout 300 pi -p --mode json --no-session "$(cat "$REPRO/prompt.txt")" \
  > "$OUT/pi-run.ndjson" 2> "$OUT/pi-run.stderr"
echo "pi exit=$?"
wc -l "$OUT/pi-run.ndjson"
