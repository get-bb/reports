#!/usr/bin/env bash
set -u

work_dir=$(mktemp -d /tmp/bb-2546-repro-XXXXXX)
cd "$work_dir"

bb plugin new probe
cd bb-plugin-probe
npm install --include=dev
npm install --save-dev vitest

cat > server.test.ts <<'TS'
import { it } from "vitest";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import plugin from "./server";

it("loads", async () => {
  const { bb } = createFakePluginHost({ pluginId: "probe" });
  await plugin(bb);
});
TS

cat > vitest.config.ts <<'TS'
import { defineConfig } from "vitest/config";

export default defineConfig({});
TS

npx vitest run --config vitest.config.ts
base_status=$?

npm install --save-dev cron-parser@^5.5.0
npx vitest run --config vitest.config.ts
workaround_status=$?

printf 'base_status=%s workaround_status=%s\n' "$base_status" "$workaround_status"
exit "$base_status"
