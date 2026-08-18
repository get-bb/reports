#!/usr/bin/env bash
# Start the packaged bb app (production build of apps/app served by bb-server) on
# isolated ports and an isolated /tmp data dir so old-WebKit tests hit the real
# bundled chunks. Delete the data dir when done (stop-prod-app.sh does this).
# Usage: start-prod-app.sh <bb repo root> [server-port=45031] [daemon-port=45032] [data-dir=/tmp/bb-1603-proddata]
set -e
REPO=${1:?bb repo root}
SP=${2:-45031}
DP=${3:-45032}
DATA=${4:-/tmp/bb-1603-proddata}
LOG=/tmp/bb-reports/issues/1603/repro/prod-app.log
mkdir -p "$DATA"
if ss -ltn | grep -qE ":($SP|$DP) "; then echo "port $SP or $DP busy"; exit 1; fi
cd "$REPO"
BB_DISABLE_AUTO_UPDATE=1 nohup node packages/bb-app/dist/bb-app.js \
  --data-dir "$DATA" --server-port "$SP" --host-daemon-port "$DP" \
  > "$LOG" 2>&1 &
echo $! > /tmp/bb-reports/issues/1603/repro/prod-app.pid
for i in $(seq 1 40); do
  if curl -fs -o /dev/null "http://localhost:$SP/"; then echo "up: http://localhost:$SP (pid $(cat /tmp/bb-reports/issues/1603/repro/prod-app.pid))"; exit 0; fi
  sleep 1
done
echo "did not come up"; tail -20 "$LOG"; exit 1
