import { afterEach, expect, it, vi } from "vitest";
import {
  createFakePluginHost,
  makeHostResponse,
} from "@get-bb/plugin-sdk/testing";

vi.mock("node:child_process", () => ({
  execFile: (
    _file: string,
    _args: readonly string[],
    _options: object,
    callback: (
      error: Error | null,
      result: { stdout: string; stderr: string },
    ) => void,
  ) => callback(null, { stdout: "", stderr: "" }),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    readFile: (file: string) =>
      Promise.resolve(
        JSON.stringify(
          file.endsWith(".credentials.json")
            ? {
                claudeAiOauth: {
                  accessToken: "test-access-token",
                  expiresAt: null,
                  subscriptionType: "pro",
                },
              }
            : { oauthAccount: { emailAddress: null } },
        ),
      ),
  },
}));

vi.mock("@get-bb/plugin-sdk/provider-bridge", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@get-bb/plugin-sdk/provider-bridge")
  >()),
  experimental_resolveExecutablePath: () => Promise.resolve("/test/claude"),
}));

import { getClaudeProviderUsage } from "./bridge/provider-maintenance.js";
import { registerUsageSource } from "./usage-source.js";
import { usageFetchMethod, usageMeasurementSchema } from "./usage-contract.js";

afterEach(() => vi.unstubAllGlobals());

it("honors a throttled response before attempting another upstream request", async () => {
  const fetchUsage = vi.fn(
    async () =>
      new Response("", { status: 429, headers: { "Retry-After": "300" } }),
  );
  vi.stubGlobal("fetch", fetchUsage);
  const first = await getClaudeProviderUsage();
  const second = await getClaudeProviderUsage();
  console.log(
    "throttled probes",
    JSON.stringify({
      first,
      second,
      upstreamRequests: fetchUsage.mock.calls.length,
    }),
  );
  expect(first).toMatchObject({ supported: true, usage: { status: "error" } });
  expect(fetchUsage).toHaveBeenCalledTimes(1);
});

it("records what the usage resource exposes after a successful read followed by an error", async () => {
  const collect = vi
    .fn()
    .mockResolvedValueOnce({
      "claude-code": {
        status: "ok",
        accountEmail: null,
        planLabel: "Pro",
        windows: [{ label: "Weekly", usedPercent: 42, resetsAt: null }],
      },
    })
    .mockResolvedValue({
      "claude-code": {
        status: "error",
        accountEmail: null,
        planLabel: "Pro",
        message: "synthetic throttling",
      },
    });
  const { bb, harness } = createFakePluginHost({
    sdk: {
      hosts: {
        get: async ({ hostId }) =>
          makeHostResponse({ id: hostId, status: "connected" }),
      },
      providers: {
        list: async () => [
          {
            id: "claude-code",
            pluginId: "provider-claude-code",
            displayName: "Claude",
          },
        ],
      },
      system: { usageLimits: collect },
    },
  });
  try {
    registerUsageSource(bb);
    const read = async (refresh: boolean) =>
      usageMeasurementSchema.parse(
        await harness.behavior.callRpc(usageFetchMethod, {
          resourceId: JSON.stringify(["test-host", "claude-code"]),
          refresh,
        }),
      );
    const good = await read(false);
    const failed = await read(true);
    const repeated = await read(false);
    console.log(
      "resource reads",
      JSON.stringify({
        good,
        failed,
        repeated,
        collections: collect.mock.calls.length,
      }),
    );
    expect(good.usage).toMatchObject({
      status: "ok",
      windows: [{ usedPercent: 42 }],
    });
    expect(failed.observedAt).toBe(good.observedAt);
    expect(failed.usage).toMatchObject({ status: "error" });
    expect(failed.usage).not.toHaveProperty("windows");
    expect(collect).toHaveBeenCalledTimes(2);
  } finally {
    await harness.lifecycle.dispose();
  }
});
