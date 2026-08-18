cd /tmp/bb-reports/issues/1615/verify
for i in 1 2 3 4 5 6 7 8; do
  echo "== attempt $i $(date +%T) load=$(cut -d' ' -f1 /proc/loadavg) availMB=$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo)"
  out=$(dev-browser --browser bb1615v3 --headless --timeout 300 run step4-open-csv.js 2>&1 | grep -v "^\s*at " | head -8)
  echo "$out"
  if echo "$out" | grep -q '"td":50000'; then break; fi
  sleep 45
done
