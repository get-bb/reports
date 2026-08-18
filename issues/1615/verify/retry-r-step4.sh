#!/bin/bash
cd /tmp/bb-reports/issues/1615/repro
dev-browser --browser bb1615r --headless --timeout 60 <<'EOF' >/dev/null 2>&1
await browser.closePage("banner");
EOF
for i in 1 2 3 4 5 6 7 8; do
  echo "== attempt $i $(date +%T) load=$(cut -d' ' -f1 /proc/loadavg) availMB=$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo)" >> /tmp/bb-reports/issues/1615/verify/retry-r-step4.log
  dev-browser --browser bb1615r --headless --timeout 200 run step4-open-csv.js > step4.out 2>&1
  if grep -q '"td":50000' step4.out; then echo "ok on attempt $i" >> /tmp/bb-reports/issues/1615/verify/retry-r-step4.log; break; fi
  head -3 step4.out >> /tmp/bb-reports/issues/1615/verify/retry-r-step4.log
  sleep 60
done
