#!/bin/bash
# Prints the relevant env vars of every running bb host-daemon process.
for p in $(pgrep -f "host-daemon"); do
  if tr '\0' '\n' < /proc/$p/environ 2>/dev/null | grep -q '^_VOLTA_TOOL_RECURSION='; then
    echo "pid $p: $(tr '\0' ' ' < /proc/$p/cmdline | cut -c1-140)"
    tr '\0' '\n' < /proc/$p/environ | grep -E '^(_VOLTA_TOOL_RECURSION|SHELL|VOLTA_HOME)='
  fi
done
