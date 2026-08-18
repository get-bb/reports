#!/usr/bin/env bash
# Runs the same #1529 prompt against claude, codex and grok raw CLIs (headless)
# to check whether the wedge is Cursor-specific. Sequential: they share /tmp/bb1529.
set -uo pipefail
REPRO="$(cd "$(dirname "$0")" && pwd)"
OUT="${OUT:-/tmp/bb1529-out}"; mkdir -p "$OUT"
PROMPT="$(cat "$REPRO/prompt.txt")"

bash "$REPRO/setup.sh"
cd /tmp/bb1529/base
timeout 300 claude -p --output-format stream-json --verbose --dangerously-skip-permissions "$PROMPT" \
  > "$OUT/claude-run.ndjson" 2> "$OUT/claude-run.stderr"
echo "claude exit=$?"

bash "$REPRO/setup.sh"
cd /tmp/bb1529/base
timeout 300 codex exec --json --dangerously-bypass-approvals-and-sandbox -C /tmp/bb1529/base "$PROMPT" \
  > "$OUT/codex-run.ndjson" 2> "$OUT/codex-run.stderr"
echo "codex exit=$?"

bash "$REPRO/setup.sh"
cd /tmp/bb1529/base
timeout 300 grok -p "$PROMPT" --output-format streaming-json --always-approve --cwd /tmp/bb1529/base \
  > "$OUT/grok-run.ndjson" 2> "$OUT/grok-run.stderr"
echo "grok exit=$?"
