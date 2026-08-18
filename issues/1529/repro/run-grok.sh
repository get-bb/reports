#!/usr/bin/env bash
# Runs the #1529 repro prompt against the raw grok CLI (headless) and saves NDJSON.
set -uo pipefail
REPRO="$(cd "$(dirname "$0")" && pwd)"
OUT="${OUT:-/tmp/bb1529-out}"; mkdir -p "$OUT"
cd /tmp/bb1529/base
timeout 300 grok -p "$(cat "$REPRO/prompt.txt")" --output-format streaming-json --always-approve --cwd /tmp/bb1529/base \
  > "$OUT/grok-run.ndjson" 2> "$OUT/grok-run.stderr"
echo "grok exit=$?"
wc -l "$OUT/grok-run.ndjson"
