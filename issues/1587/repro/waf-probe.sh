#!/usr/bin/env bash
# Unauthenticated probe: how does Cloudflare in front of chatgpt.com treat the
# two endpoints the bb host daemon uses, per User-Agent? A request that passes
# the WAF reaches the app and gets 401 (no bearer token). A request the WAF
# challenges gets 403 + "cf-mitigated: challenge" (never reaches the app).
set -u
cd "$(dirname "$0")"
UAS=(
  "bb-host-daemon"
  "codex_cli_rs/0.147.0 (Linux 7.0.0; x86_64) unknown"
  "curl/8.5.0"
  "python-requests/2.31"
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"
)
URLS=(
  https://chatgpt.com/backend-api/transcribe
  https://chatgpt.com/backend-api/codex/responses
)
for ua in "${UAS[@]}"; do
  for url in "${URLS[@]}"; do
    printf '%-95s %-48s ' "UA=$ua" "$url"
    curl -s -o /dev/null -X POST -A "$ua" -D - "$url" \
      -F file=@tone.mp3 -F model=gpt-transcribe 2>/dev/null \
      | /usr/bin/grep -iE "^HTTP/|^cf-mitigated|^server:" | tr -d '\r' | tr '\n' ' '
    echo
  done
done
