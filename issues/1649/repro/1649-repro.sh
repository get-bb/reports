#!/usr/bin/env bash
# Repro for get-bb/bb#1649: `bb automation create --script-file` copies the file at
# registration; later edits to the source file do not affect runs.
#
# Usage: BB_REPO=/abs/path/to/bb/worktree PROJECT=<proj id> ./1649-repro.sh
# Requires a running dev instance (scripts/bb-dev-app current) and a project created on it.
set -euo pipefail
: "${BB_REPO:?set BB_REPO to your bb worktree root}"
: "${PROJECT:?set PROJECT to a project id on your dev instance}"
eval "$(cd "$BB_REPO" && scripts/bb-dev-app env)"
DATA_DIR=$(cd "$BB_REPO" && scripts/bb-dev-app status | sed -n 's/^Data dir: //p')
bb() { node "$BB_REPO/packages/scripts/dist/commands/run-cli.js" "$@"; }
latest_run() {
  bb automation runs "$1" --project "$PROJECT" --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const r=(Array.isArray(j)?j:(j.runs??j.items))[0];console.log(r.id)})'
}

SRC=/tmp/1649-src/hello.sh
mkdir -p "$(dirname "$SRC")"
printf '#!/bin/sh\necho "VERSION 1"\n' > "$SRC"
echo "--- source script ($SRC):"; cat "$SRC"

echo "--- register with --script-file (note: output never mentions where the script is stored)"
OUT=$(bb automation create --project "$PROJECT" --name "issue-1649" --cron "0 0 1 1 *" --timezone UTC --script-file "$SRC")
echo "$OUT"
ID=$(echo "$OUT" | sed -n 's/^Automation created: //p')

echo "--- copy stored under the plugin data dir:"
find "$DATA_DIR/plugins/automations/scripts/$ID" -type f -exec sh -c 'echo "$1:"; cat "$1"' _ {} \;

echo "--- run #1"
bb automation run "$ID" --project "$PROJECT" >/dev/null
sleep 4
RUN1=$(latest_run "$ID")
echo "run1 output:"; bb automation runs "$ID" --project "$PROJECT" --output "$RUN1" | grep -v '^\[bb\]' | tail -4

echo "--- edit the SOURCE file (what the reporter did)"
printf '#!/bin/sh\necho "VERSION 2"\n' > "$SRC"
cat "$SRC"

echo "--- run #2 (expected: VERSION 2 if edits were honoured)"
bb automation run "$ID" --project "$PROJECT" >/dev/null
sleep 4
RUN2=$(latest_run "$ID")
echo "run2 output:"; bb automation runs "$ID" --project "$PROJECT" --output "$RUN2" | grep -v '^\[bb\]' | tail -4

echo "--- stored copy is unchanged:"
find "$DATA_DIR/plugins/automations/scripts/$ID" -type f -exec sh -c 'echo "$1:"; cat "$1"' _ {} \;

echo "--- 'show' does not reveal a source path or the stored copy path either:"
bb automation show "$ID" --project "$PROJECT"
echo "--- show --json execution:"
bb automation show "$ID" --project "$PROJECT" --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(JSON.stringify(j.execution??j.automation?.execution,null,2))})'
