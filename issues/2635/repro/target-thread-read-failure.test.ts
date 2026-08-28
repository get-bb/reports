import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import plugin from "./server.js";
import { createAutomationService } from "./service.js";

const PROJECT_ID = "proj_test";
const THREAD_ID = "thr_target";

async function createHost() {
  const host = createFakePluginHost({
    pluginId: "automations",
    sdk: {
      projects: {
        async get({ projectId }) {
          return { id: projectId, name: "Test Project", deletedAt: null };
        },
        async list() {
          return [{ id: PROJECT_ID, name: "Test Project", deletedAt: null }];
        },
      },
      providers: {
        async list() {
          return [
            {
              id: "codex",
              capabilities: {
                permissionModes: ["accept-edits", "auto", "full"],
              },
            },
          ] as never;
        },
      },
      threads: {
        async get() {
          throw new Error("temporary thread read failure");
        },
        async send() {
          return { ok: true };
        },
        async spawn() {
          throw new Error("unexpected spawn");
        },
      },
    },
  });
  await plugin(host.bb as unknown as Parameters<typeof plugin>[0]);
  return host;
}

describe("target thread read failures", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps all target automations enabled after a temporary read failure", async () => {
    const host = await createHost();
    const service = createAutomationService({
      bb: host.bb as never,
      db: host.bb.storage.database(),
      pluginDataDir: "/tmp/bb-automations-read-failure-test",
      serverUrl: "http://127.0.0.1:38886",
    });
    const execution = {
      mode: "agent" as const,
      prompt: "run the check",
      providerId: "codex",
      model: "gpt-5",
      permissionMode: "accept-edits" as const,
      environment: { type: "project-default" as const },
      targetThreadId: THREAD_ID,
    };
    const trigger = {
      triggerType: "once" as const,
      runAt: Date.now() + 60_000,
    };
    const first = await service.create({
      projectId: PROJECT_ID,
      name: "First target",
      enabled: true,
      trigger,
      execution,
      origin: "human",
    });
    const second = await service.create({
      projectId: PROJECT_ID,
      name: "Second target",
      enabled: true,
      trigger,
      execution,
      origin: "human",
    });

    await service.run({
      projectId: PROJECT_ID,
      automationId: first.id,
    });

    await vi.waitFor(() =>
      expect(
        service.runs({
          projectId: PROJECT_ID,
          automationId: first.id,
          limit: 50,
        }).runs[0]?.status,
      ).toBe("failed"),
    );
    const states = await Promise.all([
      service.get({ projectId: PROJECT_ID, automationId: first.id }),
      service.get({ projectId: PROJECT_ID, automationId: second.id }),
    ]);
    expect(states).toMatchObject([
      {
        enabled: true,
        lastError: "temporary thread read failure",
      },
      {
        enabled: true,
        lastError: null,
      },
    ]);

    await host.harness.dispose();
  });
});
