#!/bin/sh
set -eu
artifact_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
test_path=plugins/provider-codex/src/bridge/bridge.elicitation.test.ts
test -f "$test_path"
test "$(git rev-parse HEAD)" = a0e513398f02d47ec5df874b89fec4edfc248894
git diff --exit-code -- "$test_path"
pnpm install --frozen-lockfile --prefer-offline
pnpm exec turbo run build --filter=@get-bb/plugin-sdk
pnpm exec turbo run build
pnpm exec turbo run test --force --filter=bb-plugin-provider-codex -- \
  src/bridge/bridge.elicitation.test.ts \
  src/bridge/bridge.conformance.test.ts \
  src/bridge/app-server-connection.test.ts \
  src/bridge/bridge.zero-work-turn.test.ts
git apply --check "$artifact_dir/cancellation-probe.patch"
git apply "$artifact_dir/cancellation-probe.patch"
pnpm exec turbo run test --force --filter=bb-plugin-provider-codex -- \
  src/bridge/bridge.elicitation.test.ts \
  src/bridge/bridge.conformance.test.ts \
  src/bridge/app-server-connection.test.ts \
  src/bridge/bridge.zero-work-turn.test.ts
