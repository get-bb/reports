#!/usr/bin/env bash
# Usage: run-depprobe.sh <thread url>   (requires the dep probe patched into ThreadDetailView, see apply-depprobe.py)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
printf '{"pageName":"dep-%s","url":"%s","text":"The quick brown fox jumps"}\n' "$(date +%s)" "$1" > "$HOME/.dev-browser/tmp/1304-cfg.json"
dev-browser --browser wf1304b --headless run "$here/db-depprobe.js" 2>&1 | tail -5 | tee "$here/1304-depprobe.out"
