#!/usr/bin/env bash
# Probe the bb server/daemon from OUTSIDE the limited cgroup (like a browser tab
# or CLI on the same machine would) while the in-cgroup memory hog runs.
# usage: external-probe.sh <serverPort> <daemonPort> <seconds> <parallel-load-loops>
SPORT=$1; DPORT=$2; SECS=$3; PAR=${4:-4}
END=$((SECONDS + SECS))
for n in $(seq 1 $PAR); do
  ( while [ $SECONDS -lt $END ]; do
      curl -s -o /dev/null --max-time 10 "http://127.0.0.1:$SPORT/api/v1/threads"
      curl -s -o /dev/null --max-time 10 "http://127.0.0.1:$SPORT/api/v1/projects"
      curl -s -o /dev/null --max-time 10 "http://127.0.0.1:$SPORT/api/v1/hosts"
      curl -s -o /dev/null --max-time 10 "http://127.0.0.1:$SPORT/api/v1/providers"
    done ) &
done
while [ $SECONDS -lt $END ]; do
  printf '%s ' "$(date +%T)"
  curl -s -o /dev/null -w "server /health -> %{http_code} in %{time_total}s | " --max-time 5 "http://127.0.0.1:$SPORT/health" || printf "server /health -> TIMEOUT(5s) | "
  curl -s -o /dev/null -w "server /api/v1/threads -> %{http_code} in %{time_total}s | " --max-time 5 "http://127.0.0.1:$SPORT/api/v1/threads" || printf "server /api/v1/threads -> TIMEOUT(5s) | "
  curl -s -o /dev/null -w "daemon / -> %{http_code} in %{time_total}s\n" --max-time 5 "http://127.0.0.1:$DPORT/" || printf "daemon / -> TIMEOUT(5s)\n"
  sleep 2
done
wait
