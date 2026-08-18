#!/usr/bin/env bash
# Spawns a fresh acp-cursor thread on the dev instance and watches /proc for
# bb's dynamic-tool MCP server (`node <bridge> --mcp-stdio`) that Cursor should
# spawn at session/new. Captures its BB_ACP_DYNAMIC_TOOLS env into <out-file>.
# Only MCP-server pids that did NOT exist before the spawn are considered, so a
# previous thread's still-alive server is never mistaken for the new one.
# usage: BB_SERVER_URL=... spawn-and-watch.sh <project-id> <host-id> <model> <title> <out-file>
#   BB_CLI_JS may point at run-cli.js; default: <repo root>/packages/scripts/dist/commands/run-cli.js
#   where <repo root> is $BB_REPO or the git toplevel of the current directory.
set -u
unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE BB_PROJECT_ID BB_CLI
project="$1"; host="$2"; model="$3"; title="$4"; out="$5"
repo=${BB_REPO:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}
CLI=${BB_CLI_JS:-$repo/packages/scripts/dist/commands/run-cli.js}
[ -f "$CLI" ] || { echo "run-cli.js not found at $CLI (set BB_CLI_JS or run from inside the bb repo)"; exit 2; }
mcp_pids() {
  for f in $(grep -l "BB_ACP_DYNAMIC_TOOLS=" /proc/[0-9]*/environ 2>/dev/null); do
    pid=${f#/proc/}; pid=${pid%/environ}
    [ "$pid" = "$$" ] && continue
    case "$(tr '\0' ' ' < /proc/$pid/cmdline 2>/dev/null)" in *mcp-stdio*) echo "$pid";; esac
  done
}
before=" $(mcp_pids | tr '\n' ' ') "
( for i in $(seq 1 240); do
    for pid in $(mcp_pids); do
      case "$before" in *" $pid "*) continue;; esac
      echo "[procwatch] new bb MCP server alive pid=$pid cmd=$(tr '\0' ' ' < /proc/$pid/cmdline | cut -c1-160)"
      tr '\0' '\n' < "/proc/$pid/environ" | grep -E "^BB_ACP_DYNAMIC_TOOLS=" > "$out"
      exit 0
    done
    sleep 0.5
  done; echo "[procwatch] no new --mcp-stdio process seen in 120s" ) &
w=$!
node "$CLI" thread spawn --project "$project" --machine "$host" --environment /tmp/bb-1612-scratch \
  --provider acp-cursor --model "$model" --permission-mode accept-edits \
  --title "$title" --prompt "Reply only with ok." --json 2>&1 | grep -E '"id"|Error' | head -2
wait $w
