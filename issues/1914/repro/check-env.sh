#!/usr/bin/env bash
# Lists processes of the dev instance that carry the fake ANTHROPIC_BASE_URL.
for p in $(pgrep -f "wf_d5c47f31-487-6"); do
  if tr '\0' '\n' < /proc/$p/environ 2>/dev/null | command grep -q "ANTHROPIC_BASE_URL=http://127.0.0.1:45929"; then
    echo "$p has ANTHROPIC_BASE_URL: $(tr '\0' ' ' < /proc/$p/cmdline | cut -c1-140)"
  fi
done | head -10
ss -ltn | command grep -E ":(11386|19386|27386) "
