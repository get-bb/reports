#!/usr/bin/env bash
# Stop the packaged bb app started by start-prod-app.sh (only processes using our data dir).
pkill -f "data-dir /tmp/bb-reports/issues/1603/repro/prod-data" || true
sleep 3
ss -ltn | grep -E ':(45031|45032) ' || echo "ports 45031/45032 free"
