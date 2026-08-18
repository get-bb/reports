#!/usr/bin/env bash
# Issue #1131 (verification addendum): right after the server starts on the
# freshly seeded db, the periodic sweeps (destroyed-environment prune, output
# truncation) run synchronously and stall the loop for tens of seconds. This
# probes GET /health every 200 ms for ~2 min and prints the samples > 50 ms
# plus the matching "Slow DB query" / "Event loop stalled" log lines.
# Usage: BB_REPO=/abs/path/to/bb ./1131-startup-sweep-probe.sh [seconds]
set -uo pipefail
: "${BB_REPO:?set BB_REPO}"
SECS=${1:-120}
eval "$("$BB_REPO/scripts/bb-dev-app" env)"
OUT=$(mktemp)
END=$(( $(date +%s) + SECS ))
while [ "$(date +%s)" -lt "$END" ]; do
  curl -s -o /dev/null -w "$(date +%H:%M:%S.%N | cut -c1-12) health ttfb=%{time_starttransfer}s\n" "$BB_SERVER_URL/health" >> "$OUT"
  sleep 0.2
done
echo "--- /health samples > 0.05s during the first ${SECS}s after start:"
awk -F'ttfb=' '{ v=$2; sub(/s$/,"",v); if (v+0 > 0.05) print }' "$OUT"
echo "--- total samples: $(wc -l < "$OUT")"
rm -f "$OUT"
LOG=$(ls -t "$HOME/.bb-dev/launchers/"*"$(basename "$BB_REPO")"*/dev.log 2>/dev/null | head -1)
echo "--- server log: Slow DB query / Event loop stalled lines:"
grep -a "Slow DB query\|Event loop stalled" "$LOG" | tail -12 | cut -c1-700
