#!/usr/bin/env bash
# Runs the #1529 prompt against the raw claude CLI (headless).
set -uo pipefail
REPRO="$(cd "$(dirname "$0")" && pwd)"
OUT="${OUT:-/tmp/bb1529-out}"; mkdir -p "$OUT"
PROMPT="$(cat "$REPRO/prompt.txt")"
bash "$REPRO/setup.sh"
cd /tmp/bb1529/base
unset ANTHROPIC_MODEL CLAUDECODE CLAUDE_CODE_CHILD_SESSION
timeout 300 claude -p --model sonnet --output-format stream-json --verbose --dangerously-skip-permissions "$PROMPT" \
  > "$OUT/claude-run.ndjson" 2> "$OUT/claude-run.stderr"
echo "claude exit=$?"
