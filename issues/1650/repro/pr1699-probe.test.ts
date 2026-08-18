// Probe for PR #1699 edge cases (not part of the PR):
//  (a) parent is ACTIVE (real AskUserQuestion case) — does the deferred message
//      flush after settle, and through which path?
//  (b) parent transitions to "stopping" and its interaction is interrupted —
//      is the deferred row lost?
import { and, eq } from "drizzle-orm";
import {
  countDeferredParentSystemMessages,
  events,
  listQueuedThreadMessages,
  getThread,
} from "@bb/db";
import { applyLoggedThreadLifecycleEventInTransaction } from "../../src/services/threads/lifecycle-outcome.js";
import { turnRequestEventDataSchema } from "@bb/domain";
import { describe, expect, it } from "vitest";
import { queueParentSystemMessage } from "../../src/services/threads/parent-system-messages.js";
import { createUserQuestionPayload } from "../helpers/pending-interactions.js";
import { textInput } from "../helpers/prompt-input.js";
import { readJson } from "../helpers/json.js";
import {
  seedEnvironment,
  seedHostSession,
  seedProjectWithSource,
  seedThread,
  seedThreadRuntimeState,
  seedTurnStarted,
} from "../helpers/seed.js";
import { createTestAppHarness, withTestHarness } from "../helpers/test-app.js";

type TestHarness = Awaited<ReturnType<typeof createTestAppHarness>>;

function listTurnRequests(harness: TestHarness, threadId: string) {
  return harness.db
    .select()
    .from(events)
    .where(
      and(eq(events.threadId, threadId), eq(events.type, "client/turn/requested")),
    )
    .orderBy(events.sequence)
    .all()
    .map((row) => turnRequestEventDataSchema.parse(JSON.parse(row.data)));
}

function seedActiveBlockedParent(harness: TestHarness, hostId: string) {
  const { host } = seedHostSession(harness.deps, { id: hostId });
  const { project } = seedProjectWithSource(harness.deps, { hostId: host.id });
  const environment = seedEnvironment(harness.deps, {
    hostId: host.id,
    projectId: project.id,
    path: `/tmp/${hostId}`,
  });
  const parent = seedThread(harness.deps, {
    projectId: project.id,
    environmentId: environment.id,
    status: "active",
    title: "Manager",
  });
  seedThreadRuntimeState(harness.deps, {
    threadId: parent.id,
    environmentId: environment.id,
    providerThreadId: `provider-${hostId}`,
    inputText: "Manage things",
    model: "fake-model",
  });
  seedTurnStarted(harness.deps, {
    threadId: parent.id,
    turnId: `turn-${hostId}`,
    providerThreadId: `provider-${hostId}`,
  });
  const registered = harness.deps.pendingInteractions.registerPendingInteraction({
    interaction: {
      threadId: parent.id,
      turnId: `turn-${hostId}`,
      providerId: "codex",
      providerThreadId: `provider-${hostId}`,
      providerRequestId: `request-${hostId}`,
      payload: createUserQuestionPayload(),
    },
  });
  if (registered.outcome === "rejected") throw new Error(registered.reason);
  return { parent, environment, interactionId: registered.interaction.id, host };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("PR #1699 probes", () => {
  it("(a) active blocked parent: deferred child notice flushes as an active-thread steer after settle", async () => {
    await withTestHarness(async (harness) => {
      const { parent, interactionId } = seedActiveBlockedParent(harness, "host-probe-active");
      const ok = await queueParentSystemMessage(harness.deps, {
        input: textInput("Child finished"),
        parentThreadId: parent.id,
        systemMessageKind: "child-completed",
        systemMessageSubject: null,
      });
      expect(ok).toBe(true);
      expect(countDeferredParentSystemMessages(harness.db, parent.id)).toBe(1);
      harness.deps.pendingInteractions.interruptPendingInteraction({ interactionId, reason: "answered" });
      await sleep(300);
      const requests = listTurnRequests(harness, parent.id).filter((r) => r.initiator === "system");
      console.log("PROBE(a) system requests:", JSON.stringify(requests.map((r) => ({ kind: r.systemMessageKind, target: r.target }))));
      console.log("PROBE(a) deferred rows left:", countDeferredParentSystemMessages(harness.db, parent.id));
    });
  });

  it("(b) parent goes stopping, interaction interrupted: is the deferred row lost?", async () => {
    await withTestHarness(async (harness) => {
      const { parent, interactionId } = seedActiveBlockedParent(harness, "host-probe-stopping");
      await queueParentSystemMessage(harness.deps, {
        input: textInput("Child finished"),
        parentThreadId: parent.id,
        systemMessageKind: "child-completed",
        systemMessageSubject: null,
      });
      expect(countDeferredParentSystemMessages(harness.db, parent.id)).toBe(1);
      applyLoggedThreadLifecycleEventInTransaction(
        { db: harness.db, logger: harness.deps.logger },
        { event: { type: "stop.requested" }, threadId: parent.id },
      );
      console.log("PROBE(b) status now:", getThread(harness.db, parent.id)?.status);
      const logged: string[] = [];
      const origWarn = harness.deps.logger.warn.bind(harness.deps.logger);
      const origError = harness.deps.logger.error.bind(harness.deps.logger);
      (harness.deps.logger as any).warn = (obj: any, msg?: string) => { logged.push("warn: " + (msg ?? JSON.stringify(obj)) + " " + JSON.stringify(obj?.err?.message ?? obj?.message ?? "")); return origWarn(obj, msg); };
      (harness.deps.logger as any).error = (obj: any, msg?: string) => { logged.push("error: " + (msg ?? JSON.stringify(obj)) + " " + JSON.stringify(obj?.err?.message ?? "")); return origError(obj, msg); };
      harness.deps.pendingInteractions.interruptPendingInteraction({ interactionId, reason: "thread-stopped" });
      await sleep(300);
      const requests = listTurnRequests(harness, parent.id).filter((r) => r.initiator === "system");
      console.log("PROBE(b) system requests:", requests.length, "deferred rows left:", countDeferredParentSystemMessages(harness.db, parent.id));
      console.log("PROBE(b) logs:", JSON.stringify(logged));
    });
  });

  it("(c) send steer-if-active to an active blocked thread queues; queue does not drain on settle while still active", async () => {
    await withTestHarness(async (harness) => {
      const { parent, interactionId } = seedActiveBlockedParent(harness, "host-probe-send");
      const response = await harness.app.request(`/api/v1/threads/${parent.id}/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "steer-if-active", input: [{ type: "text", text: "STOP NOW" }] }),
      });
      console.log("PROBE(c) send:", response.status, JSON.stringify(await readJson(response)));
      expect(listQueuedThreadMessages(harness.db, parent.id)).toHaveLength(1);
      harness.deps.pendingInteractions.interruptPendingInteraction({ interactionId, reason: "answered" });
      await sleep(300);
      console.log("PROBE(c) queued rows after settle (thread still active):", listQueuedThreadMessages(harness.db, parent.id).length,
        "turn requests:", listTurnRequests(harness, parent.id).length);
    });
  });
});
