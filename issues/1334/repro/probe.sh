#!/usr/bin/env bash
# Probe the bb server /health and host daemon root with a 5s timeout, like the issue did.
SERVER=http://127.0.0.1:41334
DAEMON=http://127.0.0.1:41335
for url in "$SERVER/health" "$DAEMON/"; do
  start=$(date +%s.%N)
  out=$(curl -s --max-time 5 -o /dev/null -w '%{http_code}' "$url" 2>&1); rc=$?
  end=$(date +%s.%N)
  printf '%-40s rc=%s http=%s elapsed=%.2fs%s\n' "$url" "$rc" "$out" "$(echo "$end - $start" | bc)" "$([ $rc = 28 ] && echo '  (TIMEOUT)')"
done
