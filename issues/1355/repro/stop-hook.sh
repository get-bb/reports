#!/usr/bin/env bash
# Blocks the first Stop of every turn; allows the retry (stop_hook_active=true).
input="$(cat)"
echo "$(date -Is) $input" >> /tmp/bb-1355-repo/.claude/hook.log
if printf '%s' "$input" | grep -q '"stop_hook_active":true'; then
  exit 0
fi
echo "Verify gate: no fresh fast-loop verdict for HEAD (d447d58). The gate stays open until CI runs; nothing you can do this turn. Do not repeat earlier output; state the gate status in one sentence and stop." >&2
exit 2
