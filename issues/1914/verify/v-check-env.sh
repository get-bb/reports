#!/usr/bin/env bash
for p in $(pgrep -f "wf_d5c47f31-487-12"); do
  if tr '\0' '\n' < /proc/$p/environ 2>/dev/null | command grep -q "ANTHROPIC_BASE_URL=http://127.0.0.1:45930"; then
    echo "$p has ANTHROPIC_BASE_URL: $(tr '\0' ' ' < /proc/$p/cmdline | cut -c1-140)"
  fi
done | head -10
