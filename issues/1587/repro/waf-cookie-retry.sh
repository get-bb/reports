#!/usr/bin/env bash
# Does re-sending the Cloudflare cookies (__cf_bm etc.) from a challenge
# response get past the challenge on the next try? (This is what
# apps/host-daemon/src/codex-chatgpt-client.ts fetchChatGpt() does.)
set -u
cd "$(dirname "$0")"
rm -f cj.txt
for i in 1 2 3 4 5 6 7 8; do
  curl -s -o /dev/null -w "attempt $i: HTTP %{http_code}\n" -c cj.txt -b cj.txt \
    -X POST -A bb-host-daemon https://chatgpt.com/backend-api/transcribe \
    -F file=@tone.mp3 -F model=gpt-transcribe
done
echo "cookies in jar: $(/usr/bin/grep -vc '^#' cj.txt) ($(/usr/bin/grep -v '^#' cj.txt | awk '{print $6}' | tr '\n' ' '))"
