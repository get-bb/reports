#!/usr/bin/env bash
# Stop the packaged bb app started by start-prod-app.sh and remove its data dir.
# Usage: stop-prod-app.sh [data-dir=/tmp/bb-1603-proddata]
DATA=${1:-/tmp/bb-1603-proddata}
pkill -f "data-dir $DATA" || true
sleep 3
rm -rf "$DATA"
ss -ltn | grep -E ':(45031|45032) ' || echo "ports 45031/45032 free"
