#!/usr/bin/env bash
set -euo pipefail

test "$(node --version)" = "v24.18.0"
test "$(node -p 'process.versions.modules')" = "137"
test -x scripts/bb-dev-app
test -f pnpm-lock.yaml
export npm_config_package_import_method=copy

repo_root=$(pwd -P)
artifact_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
marker=/tmp/bb-report-2384-tool-enabled
plugin_dir="$repo_root/.report-private/bb-plugin-dynamic-tool-resume"
status_output=$(scripts/bb-dev-app status)
data_dir=$(printf '%s\n' "$status_output" | sed -n 's/^Data dir: //p')
eval "$(scripts/bb-dev-app env)"
app_port=$(printf '%s\n' "$status_output" | sed -n 's/^App: http:\/\/localhost://p')
server_port=${BB_SERVER_URL##*:}
host_daemon_port=$BB_HOST_DAEMON_PORT

case "$data_dir" in
  "$HOME/.bb-dev/"?*) ;;
  *) printf 'Refusing unexpected data directory: %s\n' "$data_dir" >&2; exit 1 ;;
esac

cleanup() {
  unlink "$marker" 2>/dev/null || true
  pnpm dev:stop >/dev/null 2>&1 || true
  pkill -TERM -f "$repo_root" 2>/dev/null || true
  sleep 2
  pkill -KILL -f "$repo_root" 2>/dev/null || true
  rm -rf -- "$data_dir"

  local occupied=0
  local port
  for port in "$app_port" "$server_port" "$host_daemon_port"; do
    if ss -ltn "sport = :$port" | tail -n +2 | grep -q .; then
      printf 'Port %s is still occupied.\n' "$port" >&2
      occupied=1
    fi
  done
  return "$occupied"
}
trap cleanup EXIT

mkdir -p "$plugin_dir"
cp "$artifact_dir/package.json" "$plugin_dir/package.json"
cp "$artifact_dir/server.ts" "$plugin_dir/server.ts"
unlink "$marker" 2>/dev/null || true

scripts/bb-dev-app current
eval "$(scripts/bb-dev-app env)"
pnpm bb:dev plugin install "$plugin_dir" --yes --json

bb_json() {
  pnpm bb:dev "$@" --json | sed -n '/^{/,$p'
}

spawn_initial() {
  local provider=$1
  local title=$2
  shift 2
  bb_json thread spawn \
    --project proj_personal \
    --provider "$provider" \
    "$@" \
    --permission-mode accept-edits \
    --title "$title" \
    --prompt "Reply only INITIAL_OK. Do not call a tool."
}

late_add() {
  local provider=$1
  local title=$2
  shift 2
  local thread_json
  local thread_id
  local initial_output
  local resumed_output

  unlink "$marker" 2>/dev/null || true
  thread_json=$(spawn_initial "$provider" "$title" "$@")
  thread_id=$(jq -r .id <<<"$thread_json")
  bb_json thread wait "$thread_id" --status idle --timeout 180 >/dev/null
  initial_output=$(bb_json thread output "$thread_id" | jq -r .output)

  : > "$marker"
  bb_json thread stop "$thread_id" >/dev/null
  bb_json thread tell "$thread_id" \
    "Call dynamic_tool_resume_probe exactly once. Return only its result. Do not use bash or search." \
    >/dev/null
  bb_json thread wait "$thread_id" --status idle --timeout 180 >/dev/null
  resumed_output=$(bb_json thread output "$thread_id" | jq -r .output)

  jq -n \
    --arg provider "$provider" \
    --arg threadId "$thread_id" \
    --arg initialOutput "$initial_output" \
    --arg resumedOutput "$resumed_output" \
    '{provider:$provider,threadId:$threadId,initialOutput:$initialOutput,resumedOutput:$resumedOutput}'
}

codex_late_add=$(late_add codex "DynamicToolResumeRepro Codex 2384" \
  --model gpt-5.6-sol --reasoning-level low)

codex_control_json=$(bb_json thread spawn \
  --project proj_personal \
  --provider codex \
  --model gpt-5.6-sol \
  --reasoning-level low \
  --permission-mode accept-edits \
  --title "DynamicToolResumeControl Codex 2384" \
  --prompt "Call dynamic_tool_resume_probe exactly once. Return only its result. Do not use bash or search.")
codex_control_id=$(jq -r .id <<<"$codex_control_json")
bb_json thread wait "$codex_control_id" --status idle --timeout 180 >/dev/null
codex_control_output=$(bb_json thread output "$codex_control_id" | jq -r .output)

claude_late_add=$(late_add claude-code "DynamicToolResumeRepro Claude Code 2384")

jq -n \
  --argjson codexLateAdd "$codex_late_add" \
  --arg codexControlThreadId "$codex_control_id" \
  --arg codexControlOutput "$codex_control_output" \
  --argjson claudeCodeLateAdd "$claude_late_add" \
  '{
    codexLateAdd:$codexLateAdd,
    codexFreshControl:{threadId:$codexControlThreadId,output:$codexControlOutput},
    claudeCodeLateAdd:$claudeCodeLateAdd
  }'
