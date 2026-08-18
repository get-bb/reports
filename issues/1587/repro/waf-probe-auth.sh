#!/usr/bin/env bash
# Authenticated variant of waf-probe.sh: send the exact headers the bb host
# daemon sends (Authorization bearer + chatgpt-account-id + originator + UA)
# from curl, to see whether the bearer token / account header changes the
# Cloudflare decision. Token is read from ~/.codex/auth.json and never printed.
set -u
cd "$(dirname "$0")"
TOKEN=$(python3 -c "import json;print(json.load(open('$HOME/.codex/auth.json'))['tokens']['access_token'])")
ACCOUNT=$(python3 -c "import json;print(json.load(open('$HOME/.codex/auth.json'))['tokens']['account_id'])")
URL=https://chatgpt.com/backend-api/transcribe
for variant in "auth+account+originator+ua" "auth-only" "no-auth"; do
  args=(-s -o /tmp/1587-body.txt -X POST -D - "$URL" -F file=@tone.mp3 -F model=gpt-transcribe)
  case "$variant" in
    "auth+account+originator+ua")
      args+=(-H "Authorization: Bearer $TOKEN" -H "chatgpt-account-id: $ACCOUNT" -H "originator: bb" -A "bb-host-daemon");;
    "auth-only")
      args+=(-H "Authorization: Bearer $TOKEN" -A "bb-host-daemon");;
    "no-auth")
      args+=(-A "bb-host-daemon");;
  esac
  printf '%-30s ' "$variant"
  curl "${args[@]}" 2>/dev/null | /usr/bin/grep -iE "^HTTP/|^cf-mitigated" | tr -d '\r' | tr '\n' ' '
  echo " body=$(head -c 120 /tmp/1587-body.txt | tr '\n' ' ')"
done
