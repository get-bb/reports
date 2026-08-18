#!/usr/bin/env bash
# Saves final CLI outputs for the report.
# Usage (from the bb repo root, after `eval "$(scripts/bb-dev-app env)"`):
#   PARENT=thr_xxx PROJECT=proj_xxx bash save-artifacts.sh
# CLI overrides the CLI command (default: node packages/scripts/dist/commands/run-cli.js).
# OUT_DIR is where files are written (default: this script's directory).
set -u
CLI="${CLI:-node packages/scripts/dist/commands/run-cli.js}"
OUT="${OUT_DIR:-$(cd "$(dirname "$0")" && pwd)}"
$CLI thread log "$PARENT" 2>/dev/null > "$OUT/15-parent-log-minimal-after-batch.txt"
$CLI thread log "$PARENT" --format verbose 2>/dev/null > "$OUT/16-parent-log-verbose-after-batch.txt"
$CLI thread log --help 2>/dev/null > "$OUT/17-thread-log-help.txt"
$CLI thread search --help 2>/dev/null > "$OUT/18-thread-search-help.txt"
$CLI thread list --project "$PROJECT" 2>/dev/null > "$OUT/19-thread-list.txt"
grep -n "bb system" -A6 "$OUT/15-parent-log-minimal-after-batch.txt" | tail -14
echo ----
cat "$OUT/17-thread-log-help.txt"
