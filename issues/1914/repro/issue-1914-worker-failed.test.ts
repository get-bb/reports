/**
 * Repro for get-bb/bb#1914 (workflows plugin side).
 *
 * The server fires `thread.failed` with `error: null` for provider-originated
 * failures (see apps/server/test/services/plugins/issue-1914-*.test.ts). The
 * workflows plugin then settles the call with the opaque string
 * "Workflow worker failed", and its transient-provider retry path (which
 * matches /rate.?limit|429/ on the error text) never fires.
 */
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import { afterEach, describe, expect, it } from "vitest";
import { getCall, getRunRequired, migrations } from "./data.js";
import { createWorkflowService } from "./service.js";

async function eventually(
  assertion: () => void | Promise<void>,
  timeoutMs = 3_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      await assertion();
      return;
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}

function availableModel(model: string) {
  return {
    id: model,
    model,
    displayName: model,
    description: "test",
    supportedReasoningEfforts: [
      { reasoningEffort: "medium", description: "test" },
    ],
    defaultReasoningEffort: "medium",
    isDefault: true,
  };
}

describe("issue #1914: workflow call error for a rate-limited worker", () => {
  const hosts: Array<ReturnType<typeof createFakePluginHost>["harness"]> = [];
  afterEach(async () => {
    await Promise.all(hosts.map((host) => host.dispose()));
    hosts.length = 0;
  });

  function setup() {
    let childCount = 0;
    const { bb, harness } = createFakePluginHost({
      pluginId: "workflows",
      sdk: {
        threads: {
          get: async ({ threadId }) =>
            ({
              id: threadId,
              environmentId: "environment-1",
              providerId: "claude-code",
              status: threadId === "origin" ? "idle" : "working",
            }) as never,
          defaultExecutionOptions: async () => ({
            model: "model-a",
            reasoningLevel: "medium",
            permissionMode: "accept-edits",
            serviceTier: "default",
            source: "default",
          }),
          spawn: async () => {
            childCount += 1;
            return { id: `child-${childCount}` } as never;
          },
          send: async () => ({ ok: true }),
          stop: async () => ({ ok: true }),
        },
        providers: {
          list: async () => [
            {
              id: "claude-code",
              displayName: "Claude Code",
              logoUrl: null,
              available: true,
              capabilities: {
                supportsThreadArchive: true,
                supportsThreadRename: true,
                supportsServiceTier: true,
                supportsNativeUserQuestion: false,
                supportsFork: true,
                permissionModes: ["accept-edits", "auto", "full"],
              },
              composerActions: [],
            },
          ],
          models: async () => ({
            providers: [],
            models: [availableModel("model-a")],
            selectedOnlyModels: [],
            modelLoadError: null,
          }),
        },
      },
    });
    hosts.push(harness);
    const db = bb.storage.database();
    bb.storage.migrate(db, migrations);
    const service = createWorkflowService(bb, db);
    return { bb, db, service, harness, childCount: () => childCount };
  }

  it("surfaces the provider failure instead of 'Workflow worker failed'", async () => {
    const test = setup();
    const controller = new AbortController();
    const worker = test.service.runWorker(controller.signal);
    const run = await test.service.start({
      projectId: "project-test",
      originThreadId: "origin",
      source: `export const meta = { name: "collect", description: "t" };
        return await agent("Collect");`,
      args: null,
      resumedFromRunId: null,
    });
    await eventually(() => expect(test.childCount()).toBe(1));

    // This is exactly what plugins/workflows/src/server.ts receives from
    // bb.events.on("thread.failed") when the child hit a Claude 429:
    // the server's payload has `error: null`.
    test.service.onThreadFailed("child-1", null);

    await eventually(() => {
      expect(getRunRequired(test.db, run.id).status).toBe("failed");
    });
    const call = getCall(test.db, run.id, 0);
    const runRow = getRunRequired(test.db, run.id);
    // Document what main produces today:
    // eslint-disable-next-line no-console
    console.log("[issue-1914] call.error =", JSON.stringify(call?.error));
    // eslint-disable-next-line no-console
    console.log("[issue-1914] run.error  =", JSON.stringify(runRow.error));
    // eslint-disable-next-line no-console
    console.log("[issue-1914] retries    =", call?.providerRetryAttempts);

    // Expected: the call error names the rate limit (category/429/message).
    expect(call?.error).not.toBe("Workflow worker failed");
    expect(call?.error ?? "").toMatch(/rate.?limit|429/i);

    controller.abort();
    await worker;
  });
});
