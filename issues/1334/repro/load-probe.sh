#!/usr/bin/env bash
# Issue N sequential API requests against the bb server and report per-request latency.
# Emulates the app polling/loading a thread while the execution plane is under pressure.
N=${1:-10}
for i in $(seq 1 "$N"); do
  start=$(date +%s.%N)
  code=$(curl -s --max-time 30 -o /dev/null -w '%{http_code}' \
    "http://127.0.0.1:41334/api/v1/threads/thr_sa6wb9uki8/timeline"); rc=$?
  end=$(date +%s.%N)
  printf '%s  timeline #%-2s rc=%s http=%s %.2fs\n' "$(date +%T)" "$i" "$rc" "$code" "$(echo "$end - $start" | bc)"
done
