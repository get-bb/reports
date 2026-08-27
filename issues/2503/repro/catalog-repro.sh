#!/usr/bin/env bash
set -euo pipefail

eval "$(scripts/bb-dev-app env)"
catalog_file=$(mktemp /tmp/bb-2503-catalog-XXXXXX.json)
trap 'rm -f "$catalog_file"' EXIT

node packages/scripts/dist/commands/run-cli.js \
  provider models acp-cursor --json >"$catalog_file"

for model in grok-4.6 gpt-5.6-sol claude-opus-5 claude-fable-5 composer-2.5; do
  jq -r --arg model "$model" '
    .[] | select(.id == $model) |
    [.supportedReasoningEfforts[].reasoningEffort] as $levels |
    "\(.id): \(if ($levels | length) == 0 then "<none>" else ($levels | join(",")) end)"
  ' "$catalog_file"
done

actual=$(jq -c '
  .[] | select(.id == "gpt-5.6-sol") |
  [.supportedReasoningEfforts[].reasoningEffort]
' "$catalog_file")
expected='["none","low","medium","high","xhigh","max"]'

if [[ "$actual" != "$expected" ]]; then
  echo "FAIL: GPT-5.6 Sol expected $expected but received $actual" >&2
  exit 1
fi
