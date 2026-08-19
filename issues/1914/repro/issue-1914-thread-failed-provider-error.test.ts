/**
 * Repro for get-bb/bb#1914.
 *
 * A provider-originated failure (Claude Code 429 "rate_limit_event") is
 * persisted as `provider/rateLimits/updated` + `provider/error` (with
 * errorInfo) + `turn/completed status=failed`. No `system/error` row is ever
 * written on that path. The plugin `thread.failed` payload builds its `error`
 * field ONLY from the latest `system/error` row, so plugin consumers such as
 * the workflows plugin receive `error: null` and fall back to the opaque
 * "Workflow worker failed" string.
 *
 * Events are ingested through the REAL host-daemon seam
 * (POST /internal/session/events), which is what applies `run.failed` and
 * fires the plugin event.
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getThread } from "@bb/db";
import { threadScope, turnScope } from "@bb/domain";
import { groupHostDaemonEvents } from "@bb/host-daemon-contract";
import { describe, expect, it, vi } from "vitest";
import {
  createTestDaemonEventEnvelope,
  internalAuthHeaders,
} from "../../helpers/commands.js";
import { seedThreadFixture } from "../../helpers/seed.js";
import { createTestAppHarness } from "../../helpers/test-app.js";

interface RecordedFailedPayload {
  thread: { id: string; status: string };
  error: string | null;
}

const globals = globalThis as Record<string, unknown>;

describe("issue #1914: thread.failed error for provider-originated failures", () => {
  it("carries the provider/error (429 rate limit) detail to plugin thread.failed handlers", async () => {
    const recorded: RecordedFailedPayload[] = [];
    globals.__issue1914Failed = recorded;
    const harness = await createTestAppHarness();
    const workDir = await mkdtemp(join(tmpdir(), "bb-issue-1914-"));
    const rootDir = join(workDir, "bb-plugin-observer");
    await mkdir(rootDir, { recursive: true });
    await writeFile(
      join(rootDir, "package.json"),
      JSON.stringify({
        name: "bb-plugin-observer",
        version: "0.1.0",
        bb: {
          name: "Observer fixture",
          description: "Thread events plugin fixture.",
          branding: { icon: "Zap" },
          server: "./server.ts",
        },
      }),
    );
    await writeFile(
      join(rootDir, "server.ts"),
      `
      export default function plugin(bb: any) {
        bb.events.on("thread.failed", (payload: any) => {
          (globalThis as any).__issue1914Failed.push(payload);
        });
      }
    `,
    );
    const entry = await harness.pluginService.installPath(rootDir);
    expect(entry.status).toBe("running");
    try {
      const { host, session, thread } = seedThreadFixture(harness, {
        thread: { status: "active", providerId: "claude-code" },
      });
      const turnId = "turn-1914";
      // Exactly the event shapes the claude-code provider plugin emits for a
      // hard rate-limit rejection (plugins/provider-claude-code/src/event-translation.ts
      // `case "rate_limit_event"` + the following `result` message).
      const response = await harness.app.request("/internal/session/events", {
        method: "POST",
        headers: internalAuthHeaders(harness, { hostId: host.id }),
        body: JSON.stringify({
          sessionId: session.id,
          eventGroups: groupHostDaemonEvents([
            createTestDaemonEventEnvelope({
              threadId: thread.id,
              event: {
                type: "turn/started",
                threadId: thread.id,
                providerThreadId: "claude-session-1",
                scope: turnScope(turnId),
              },
            }),
            createTestDaemonEventEnvelope({
              threadId: thread.id,
              event: {
                type: "provider/rateLimits/updated",
                threadId: thread.id,
                providerThreadId: "claude-session-1",
                scope: threadScope(),
                rateLimits: {
                  providerId: "claude-code",
                  status: "blocked",
                  kind: "subscription-window",
                  windows: [
                    {
                      providerKey: "five_hour",
                      label: "5h",
                      status: "blocked",
                      resetsAtMs: 1_800_000_000_000,
                    },
                  ],
                  reachedReason: "five_hour",
                  overageStatus: "rejected",
                  overageReason: "org_level_disabled",
                },
              },
            }),
            createTestDaemonEventEnvelope({
              threadId: thread.id,
              event: {
                type: "provider/error",
                threadId: thread.id,
                providerThreadId: "claude-session-1",
                scope: turnScope(turnId),
                message: "Provider error",
                detail:
                  "You've hit your session limit - resets 2:40pm (rate_limit_event, HTTP 429)",
                errorInfo: {
                  category: "rate-limit",
                  providerCode: "rate_limit_event",
                  httpStatusCode: 429,
                },
              },
            }),
            createTestDaemonEventEnvelope({
              threadId: thread.id,
              event: {
                type: "turn/completed",
                threadId: thread.id,
                providerThreadId: "claude-session-1",
                scope: turnScope(turnId),
                status: "failed",
              },
            }),
          ]),
        }),
      });
      expect(response.status).toBe(200);

      // The thread really did land in `error` ...
      expect(getThread(harness.db, thread.id)?.status).toBe("error");
      // ... and the plugin got a thread.failed ...
      await vi.waitFor(() => expect(recorded).toHaveLength(1));
      expect(recorded[0]?.thread.id).toBe(thread.id);
      expect(recorded[0]?.thread.status).toBe("error");
      // ... but `error` must describe the 429. On main it is `null`, so the
      // workflows plugin shows "Workflow worker failed".
      expect(recorded[0]?.error).not.toBeNull();
      expect(recorded[0]?.error).toMatch(/rate.?limit|429|session limit/i);
    } finally {
      delete globals.__issue1914Failed;
      await harness.pluginService.stop();
      await rm(workDir, { recursive: true, force: true });
      await harness.cleanup();
    }
  });
});
