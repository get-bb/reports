import { performance } from "node:perf_hooks";
import { turnScope } from "@bb/domain";
import {
  groupHostDaemonEvents,
  type HostDaemonEventEnvelope,
} from "@bb/host-daemon-contract";
import { expect, it } from "vitest";
import { internalAuthHeaders } from "../helpers/commands.js";
import { seedThreadFixture } from "../helpers/seed.js";
import { withTestHarness } from "../helpers/test-app.js";

it("measures timer starvation while the real route stores a reconnect backlog", async () => {
  await withTestHarness(async (harness) => {
    const { session, thread } = seedThreadFixture(harness);
    const post = (envelopes: HostDaemonEventEnvelope[]) =>
      harness.app.request("/internal/session/events", {
        method: "POST",
        headers: internalAuthHeaders(harness),
        body: JSON.stringify({
          sessionId: session.id,
          eventGroups: groupHostDaemonEvents(envelopes),
        }),
      });
    const started = await post([
      {
        threadId: thread.id,
        event: {
          type: "turn/started",
          threadId: thread.id,
          providerThreadId: "provider-repro",
          scope: turnScope("turn-repro"),
        },
      },
    ]);
    expect(started.status).toBe(200);
    for (const count of [500, 150_000]) {
      const envelopes: HostDaemonEventEnvelope[] = Array.from(
        { length: count },
        (_, index) => ({
          threadId: thread.id,
          event: {
            type: "item/agentMessage/delta",
            threadId: thread.id,
            providerThreadId: "provider-repro",
            scope: turnScope("turn-repro"),
            itemId: "item-repro",
            delta: `delta-${index}`,
          },
        }),
      );
      const startedAt = performance.now();
      const timer = new Promise<number>((resolve) =>
        setTimeout(() => resolve(performance.now() - startedAt), 0),
      );
      const response = await post(envelopes);
      const elapsedMs = performance.now() - startedAt;
      const timerDelayMs = await timer;
      console.log(
        JSON.stringify({
          count,
          status: response.status,
          elapsedMs: Math.round(elapsedMs),
          timerDelayMs: Math.round(timerDelayMs),
        }),
      );
      expect(response.status).toBe(200);
    }
  });
}, 60_000);
