#!/usr/bin/env bash
# Part A of the #2190 report, product-level, on an isolated dev instance.
# Run from the repo root AFTER `scripts/bb-dev-app current` has started the instance.
# Every value is derived; nothing is hard-coded to one worktree.
set -u
export _ZO_DOCTOR=0
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT" || exit 1
OUT=/tmp/bb-reports/issues/2190/repro
TOOL="$ROOT/packages/db/test/issue-2190-live-inspect.mjs"

log() { printf '\n$ %s\n' "$*"; }

log 'eval "$(scripts/bb-dev-app env)"; echo "$BB_SERVER_URL"'
eval "$(scripts/bb-dev-app env)"
echo "$BB_SERVER_URL"

log 'DATA=$(scripts/bb-dev-app status | sed -n "s/^Data dir: //p"); echo "$DATA"'
DATA=$(scripts/bb-dev-app status | sed -n 's/^Data dir: //p')
echo "$DATA"

log 'until curl -sf "$BB_SERVER_URL/api/v1/projects" >/dev/null; do sleep 1; done; curl -s "$BB_SERVER_URL/api/v1/projects"'
until curl -sf "$BB_SERVER_URL/api/v1/projects" >/dev/null; do sleep 1; done
curl -s "$BB_SERVER_URL/api/v1/projects"; echo

log 'ls -la "$DATA"/bb.db*'
ls -la "$DATA"/bb.db* | awk '{print $5, $9}' | sed "s|$DATA/||"

log 'HOST_ID=$(curl -s "$BB_SERVER_URL/api/v1/hosts" | node -e "let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{const j=JSON.parse(s);const a=Array.isArray(j)?j:(j.hosts||j.items||[]);console.log(a[0].id)})"); echo "$HOST_ID"'
HOST_ID=$(curl -s "$BB_SERVER_URL/api/v1/hosts" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const a=Array.isArray(j)?j:(j.hosts||j.items||[]);console.log(a[0].id)})')
echo "$HOST_ID"

log 'mkdir -p /tmp/bb2190-qa-repo && git -C /tmp/bb2190-qa-repo init -q'
mkdir -p /tmp/bb2190-qa-repo && git -C /tmp/bb2190-qa-repo init -q && echo ok

log "curl -s -X POST \"\$BB_SERVER_URL/api/v1/projects\" -H 'content-type: application/json' -d '{\"name\":\"qa-2190\",\"source\":{\"type\":\"local_path\",\"path\":\"/tmp/bb2190-qa-repo\",\"hostId\":\"'\$HOST_ID'\"}}'"
curl -s -X POST "$BB_SERVER_URL/api/v1/projects" -H 'content-type: application/json' \
  -d '{"name":"qa-2190","source":{"type":"local_path","path":"/tmp/bb2190-qa-repo","hostId":"'"$HOST_ID"'"}}' | cut -c1-160; echo

log 'node packages/db/test/issue-2190-live-inspect.mjs "$DATA"   # (saved as live-inspect-running.json)'
node "$TOOL" "$DATA" | tee "$OUT/live-inspect-running.json" | head -16

log 'ls -la "$DATA"/bb.db*'
ls -la "$DATA"/bb.db* | awk '{print $5, $9}' | sed "s|$DATA/||"

log 'lsof -nP -- "$DATA/bb.db" | awk "{print \$1, \$2}" | sort -u     # who has bb.db open'
lsof -nP -- "$DATA/bb.db" | awk '{print $1, $2}' | sort -u

log 'SERVER_PID=$(lsof -nP -t -- "$DATA/bb.db" | sort -u | head -1); echo "$SERVER_PID"'
SERVER_PID=$(lsof -nP -t -- "$DATA/bb.db" | sort -u | head -1)
echo "$SERVER_PID"

log 'kill -TERM "$SERVER_PID"; while kill -0 "$SERVER_PID" 2>/dev/null; do sleep 0.2; done; echo "server exited"'
kill -TERM "$SERVER_PID"
while kill -0 "$SERVER_PID" 2>/dev/null; do sleep 0.2; done
echo "server exited"

log 'ls -la "$DATA"/bb.db*   # immediately after exit'
ls -la "$DATA"/bb.db* | awk '{print $5, $9}' | sed "s|$DATA/||"

log 'node packages/db/test/issue-2190-live-inspect.mjs "$DATA"   # (saved as live-inspect-after-sigterm.json)'
node "$TOOL" "$DATA" | tee "$OUT/live-inspect-after-sigterm.json" | head -16

log 'lsof -nP -- "$DATA/bb.db" | awk "{print \$1, \$2}" | sort -u   # dev supervisor may have restarted the server by now'
lsof -nP -- "$DATA/bb.db" | awk '{print $1, $2}' | sort -u
