#!/usr/bin/env bash
set -u

repo_root=${1:?"Pass the bb checkout path."}
artifact_dir=$(cd "$(dirname "$0")" && pwd)
cli="$repo_root/apps/cli/dist/index.js"
server_port=$(node -e 'const net = require("node:net"); const server = net.createServer(); server.listen(0, "127.0.0.1", () => { console.log(server.address().port); server.close(); });')
server_pid=

if ss -ltnH "sport = :$server_port" | grep -q .; then
  echo "The selected port $server_port is not free." >&2
  exit 1
fi

stop_server() {
  if test -n "$server_pid" && kill -0 "$server_pid" 2>/dev/null; then
    kill "$server_pid"
    wait "$server_pid" 2>/dev/null || true
  fi
  server_pid=
}

cleanup() {
  stop_server
}
trap cleanup EXIT

start_server() {
  local mode=$1
  : > "$artifact_dir/server-$mode.log"
  BB_SERVER_PORT=$server_port \
    REPRO_MODE=$mode \
    node "$artifact_dir/fake-server.mjs" \
    > "$artifact_dir/server-$mode.log" 2>&1 &
  server_pid=$!
  for _ in $(seq 1 50); do
    grep -q '^ready ' "$artifact_dir/server-$mode.log" && return
    sleep 0.1
  done
  echo "The fake server did not start." >&2
  exit 1
}

run_cli() {
  env -u BB_CLI -u BB_THREAD_ID \
    BB_SERVER_URL="http://127.0.0.1:$server_port" \
    BB_PROJECT_ID=proj_xxxxxxxxxx \
    node "$cli" "$@"
}

{
  printf '$ BB_SERVER_URL=http://127.0.0.1:%s BB_PROJECT_ID=proj_xxxxxxxxxx bb status\n' "$server_port"
  set +e
  run_cli status
  result=$?
  set -e
  echo "exit=$result"
} > "$artifact_dir/closed-port-status.txt" 2>&1

set +e
BB_REPRO_REPO="$repo_root" BB_REPRO_PORT="$server_port" \
  node --test "$artifact_dir/status-dead.test.mjs" \
  > "$artifact_dir/status-dead.test.log" 2>&1
test_result=$?
set -e
sed -i \
  -e "s|file://$artifact_dir/|issues/2382/repro/|g" \
  -e "s|$artifact_dir/|issues/2382/repro/|g" \
  "$artifact_dir/status-dead.test.log"

start_server stall-all
: > "$artifact_dir/stall-results.txt"
for command_name in status plugin-list; do
  stdout_file="$artifact_dir/stalled-$command_name.stdout"
  stderr_file="$artifact_dir/stalled-$command_name.stderr"
  : > "$stdout_file"
  : > "$stderr_file"
  set +e
  if test "$command_name" = status; then
    timeout 3s env -u BB_CLI -u BB_THREAD_ID \
      BB_SERVER_URL="http://127.0.0.1:$server_port" \
      BB_PROJECT_ID=proj_xxxxxxxxxx \
      node "$cli" status \
      > "$stdout_file" 2> "$stderr_file"
  else
    timeout 3s env -u BB_CLI -u BB_THREAD_ID \
      BB_SERVER_URL="http://127.0.0.1:$server_port" \
      BB_PROJECT_ID=proj_xxxxxxxxxx \
      node "$cli" plugin list \
      > "$stdout_file" 2> "$stderr_file"
  fi
  result=$?
  set -e
  printf '%s exit=%s stdout_bytes=%s stderr_bytes=%s\n' \
    "$command_name" "$result" "$(wc -c < "$stdout_file")" \
    "$(wc -c < "$stderr_file")" \
    >> "$artifact_dir/stall-results.txt"
done

set +e
/usr/bin/time -p -o "$artifact_dir/stalled-plugin-probe.time" \
  timeout 15s env -u BB_CLI -u BB_THREAD_ID \
  BB_SERVER_URL="http://127.0.0.1:$server_port" \
  BB_PROJECT_ID=proj_xxxxxxxxxx \
  node "$cli" tasks list \
  > "$artifact_dir/stalled-plugin-probe.stdout" \
  2> "$artifact_dir/stalled-plugin-probe.stderr"
result=$?
set -e
printf 'plugin-probe exit=%s stdout_bytes=%s stderr_bytes=%s\n' \
  "$result" "$(wc -c < "$artifact_dir/stalled-plugin-probe.stdout")" \
  "$(wc -c < "$artifact_dir/stalled-plugin-probe.stderr")" \
  >> "$artifact_dir/stall-results.txt"
stop_server

start_server dispatch-stall
set +e
timeout 3s env -u BB_CLI -u BB_THREAD_ID \
  BB_SERVER_URL="http://127.0.0.1:$server_port" \
  BB_PROJECT_ID=proj_xxxxxxxxxx \
  node "$cli" tasks list \
  > "$artifact_dir/stalled-plugin-command.stdout" \
  2> "$artifact_dir/stalled-plugin-command.stderr"
result=$?
set -e
printf 'plugin-command exit=%s stdout_bytes=%s stderr_bytes=%s\n' \
  "$result" "$(wc -c < "$artifact_dir/stalled-plugin-command.stdout")" \
  "$(wc -c < "$artifact_dir/stalled-plugin-command.stderr")" \
  >> "$artifact_dir/stall-results.txt"

cat "$artifact_dir/closed-port-status.txt"
printf 'status-dead-test exit=%s\n' "$test_result"
cat "$artifact_dir/stall-results.txt"
