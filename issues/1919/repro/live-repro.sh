#!/usr/bin/env bash
# Live repro for get-bb/bb#1919 against a running bb dev server.
# Usage: BB_SERVER_URL=http://localhost:<port> BB_DATA_DIR=<data dir> bash live-repro.sh [N]
# Prereq: the fdleak plugin is installed and running:
#   pnpm bb:dev plugin install /tmp/bb-1919-plugin/bb-plugin-fdleak --yes
set -euo pipefail
N="${1:-300}"
URL="${BB_SERVER_URL:?}/api/v1/plugins/fdleak/http/ping"
PID=$(curl -s "$URL" | python3 -c 'import sys,json;print(json.load(sys.stdin)["pid"])')
DBFILE="${BB_DATA_DIR:?}/plugins/fdleak/data.db"
count() { ls -l /proc/"$PID"/fd 2>/dev/null | grep -c -- "-> ${DBFILE}$" || true; }
total() { ls /proc/"$PID"/fd | wc -l; }
echo "server pid=$PID  data.db=$DBFILE"
echo "before: fds on data.db=$(count)  total fds=$(total)  (soft limit: $(grep 'open files' /proc/$PID/limits | awk '{print $4}'))"
for i in $(seq 1 "$N"); do curl -s -o /dev/null "$URL"; done
echo "after $N GET $URL:"
echo "after : fds on data.db=$(count)  total fds=$(total)"
echo "by file:"
ls -l /proc/"$PID"/fd | grep -o "plugins/fdleak/data.db.*" | sort | uniq -c
