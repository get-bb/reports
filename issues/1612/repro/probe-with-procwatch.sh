#!/usr/bin/env bash
# Runs acp-probe.mjs and concurrently watches /proc for the stub MCP server
# process (env PROBE_SCHEMA=...) to prove cursor-agent spawned it.
# usage: probe-with-procwatch.sh <model> <none|recursive|flat>
set -u
here=$(cd "$(dirname "$0")" && pwd)
( for i in $(seq 1 240); do
    f=$(grep -l "PROBE_SCHEMA=" /proc/[0-9]*/environ 2>/dev/null | grep -v "$$" | head -1)
    if [ -n "$f" ]; then pid=${f#/proc/}; pid=${pid%/environ}; echo "[procwatch] stub MCP alive pid=$pid cmd=$(tr '\0' ' ' < /proc/$pid/cmdline | cut -c1-120)"; sleep 5; fi
    sleep 0.5
  done ) &
w=$!
cd /tmp/bb-1612-scratch && node "$here/acp-probe.mjs" "$1" "$2"
kill $w 2>/dev/null
