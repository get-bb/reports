#!/usr/bin/env bash
set -euo pipefail

expected_node="v24.18.0"
expected_abi="137"
invalid_model="claude-does-not-exist-9"

if [[ "$(node --version)" != "$expected_node" ]]; then
  printf 'ERROR: Node must be %s. Actual: %s\n' "$expected_node" "$(node --version)" >&2
  exit 2
fi
if [[ "$(node -p 'process.versions.modules')" != "$expected_abi" ]]; then
  printf 'ERROR: Node ABI must be %s. Actual: %s\n' "$expected_abi" "$(node -p 'process.versions.modules')" >&2
  exit 2
fi
if [[ ! -x scripts/bb-dev-app || ! -f pnpm-lock.yaml ]]; then
  printf '%s\n' 'ERROR: Run this script from the root of the bb checkout.' >&2
  exit 2
fi

printf '%s\n' 'START_DEV_INSTANCE'
scripts/bb-dev-app current
eval "$(scripts/bb-dev-app env)"

dev_status="$(scripts/bb-dev-app status)"
printf '%s\n%s\n' 'DEV_STATUS' "$dev_status"
data_dir="$(awk -F': ' '$1 == "Data dir" { print $2 }' <<<"$dev_status")"
if [[ -z "$data_dir" || ! -f "$data_dir/bb.db" ]]; then
  printf '%s\n' 'ERROR: The checkout-specific data directory is not ready.' >&2
  exit 2
fi
curl -fsS "$BB_SERVER_URL/health" >/dev/null

printf '%s\n' 'MACHINE_LIST_JSON'
machine_json="$(node packages/scripts/dist/commands/run-cli.js machine list --json)"
printf '%s\n' "$machine_json"
host_id="$(jq -er 'map(select(.status == "connected"))[0].id' <<<"$machine_json")"

printf '%s\n' 'CLAUDE_MODEL_CATALOG_JSON'
models_json="$(node packages/scripts/dist/commands/run-cli.js provider models claude-code --json)"
# Keep the complete catalog shape. Redact private custom model identifiers.
jq 'map(if .description == "Custom model" then .id = "<redacted-custom-model>" | .model = "<redacted-custom-model>" | .displayName = "<redacted-custom-model>" else . end)' <<<"$models_json"
if jq -e --arg invalid "$invalid_model" 'any(.[]; .id == $invalid or .model == $invalid)' <<<"$models_json" >/dev/null; then
  printf 'ERROR: The invalid test model unexpectedly exists: %s\n' "$invalid_model" >&2
  exit 2
fi
jq -e 'any(.[]; .id == "claude-haiku-4-5-20251001" and [.supportedReasoningEfforts[].reasoningEffort] == ["low"])' <<<"$models_json" >/dev/null

repro_repo="$(mktemp -d /tmp/bb-2400-source-XXXXXX)"
git -C "$repro_repo" init -b main
git -C "$repro_repo" -c user.name=QA -c user.email=qa@example.invalid \
  commit --allow-empty -m Initial

project_json="$(curl -fsS -X POST "$BB_SERVER_URL/api/v1/projects" \
  -H 'content-type: application/json' \
  -d "$(jq -nc --arg path "$repro_repo" --arg hostId "$host_id" \
    '{name:"qa-2400",source:{type:"local_path",path:$path,hostId:$hostId}}')")"
project_id="$(jq -er '.id' <<<"$project_json")"
printf '%s\n%s\n' 'PROJECT_CREATE_JSON' "$project_json"

count_state() {
  local label="$1"
  printf '%s\n' "$label"
  sqlite3 -json "$data_dir/bb.db" <<SQL
SELECT
  (SELECT count(*) FROM threads WHERE project_id = '$project_id') AS threads,
  (SELECT count(*) FROM environments WHERE project_id = '$project_id') AS environments,
  (SELECT count(*) FROM events JOIN threads ON threads.id = events.thread_id WHERE threads.project_id = '$project_id') AS events,
  (SELECT count(*) FROM events JOIN threads ON threads.id = events.thread_id WHERE threads.project_id = '$project_id' AND events.type = 'thread/identity') AS provider_threads,
  (SELECT count(*) FROM events JOIN threads ON threads.id = events.thread_id WHERE threads.project_id = '$project_id' AND events.type = 'turn/started') AS provider_turns;
SQL
  if [[ -d "$data_dir/worktrees" ]]; then
    find "$data_dir/worktrees" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort
  fi
}

before_state="$(count_state STATE_BEFORE)"
printf '%s\n' "$before_state"

spawn_stdout="$(mktemp /tmp/bb-2400-spawn-stdout-XXXXXX)"
spawn_stderr="$(mktemp /tmp/bb-2400-spawn-stderr-XXXXXX)"
set +e
node packages/scripts/dist/commands/run-cli.js thread spawn \
  --project "$project_id" \
  --new-environment worktree \
  --provider claude-code \
  --model "$invalid_model" \
  --reasoning-level medium \
  --title "Issue 2400 invalid model" \
  --prompt hello \
  --json >"$spawn_stdout" 2>"$spawn_stderr"
spawn_rc=$?
set -e

printf '%s\n' 'SPAWN_STDOUT'
sed -n '1,240p' "$spawn_stdout"
printf '%s\n' 'SPAWN_STDERR'
sed -n '1,240p' "$spawn_stderr"
printf 'SPAWN_RC=%s\n' "$spawn_rc"

after_state="$(count_state STATE_AFTER)"
printf '%s\n' "$after_state"

expected_error="Model \"$invalid_model\" is not available for provider claude-code on the selected machine."
if [[ "$spawn_rc" -ne 0 ]]; then
  if ! grep -Fq "$expected_error" "$spawn_stderr"; then
    printf '%s\n' 'FAIL: Spawn returned an unexpected error. The catalog rejection did not occur.' >&2
    exit 1
  fi
  if [[ "$before_state" != "${after_state/STATE_AFTER/STATE_BEFORE}" ]]; then
    printf '%s\n' 'FAIL: The rejected spawn changed a thread, environment, event, worktree, or provider-turn count.' >&2
    exit 1
  fi
  printf '%s\n' 'PASS: The server returned the exact catalog error and created no side effects.'
  exit 0
fi

thread_id="$(jq -er '.id' "$spawn_stdout")"
printf 'DYNAMIC_THREAD_ID=%s\n' "$thread_id"
set +e
node packages/scripts/dist/commands/run-cli.js thread wait "$thread_id" --status error --timeout 180
wait_rc=$?
set -e
printf 'WAIT_FOR_ERROR_RC=%s\n' "$wait_rc"
printf '%s\n' 'THREAD_SHOW_JSON'
node packages/scripts/dist/commands/run-cli.js thread show "$thread_id" --json
printf '%s\n' 'THREAD_LOG_JSON'
node packages/scripts/dist/commands/run-cli.js thread log "$thread_id" --json
printf '%s\n' 'REPRODUCED: Spawn returned zero and created a thread, worktree, provider thread, and failed provider turn.'
printf '%s\n' 'Run pnpm dev:stop after review.'
exit 1
