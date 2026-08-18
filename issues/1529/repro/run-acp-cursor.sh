#!/usr/bin/env bash
# Drive `cursor-agent acp` directly (the exact process bb's acp-cursor provider
# spawns) and record the raw ACP tool_call updates.
# Outputs go to $OUT (default /tmp/bb1529-out) so re-runs do not clobber the
# archived evidence next to this script.
set -uo pipefail
REPRO="$(cd "$(dirname "$0")" && pwd)"
OUT="${OUT:-/tmp/bb1529-out}"; mkdir -p "$OUT"
bash "$REPRO/setup.sh"
timeout 420 node "$REPRO/acp-client.mjs" /tmp/bb1529/base "$REPRO/prompt.txt" \
  > "$OUT/acp-cursor-updates.ndjson" 2> "$OUT/acp-cursor.stderr"
echo "acp exit=$?"
wc -l "$OUT/acp-cursor-updates.ndjson"
