// Repro for get-bb/bb#1650: a thread blocked on a pending user interaction
// (AskUserQuestion / approval) refuses `send` with 409, and the parent-
// notification path drops child completions with `false`, and neither leaves a
// trace on the RECIPIENT side. After the interaction settles, nothing is
// delivered.
//
// On main (16ceb3a54) the assertions marked "BUG" fail on purpose: they encode
// the behavior a reader would expect (the message survives), not what happens.
import { and, eq } from "drizzle-orm";
import { events, listQueuedThreadMessages } from "@bb/db";
import { turnRequestEventDataSchema } from "@bb/domain";
import { describe, expect, it } from "vitest";
import { queueParentSystemMessage } from "../../src/services/threads/parent-system-messages.js";
import { readJson } from "../helpers/json.js";
import {
  reportQueuedCommandSuccess,
  waitForQueuedCommand,
} from "../helpers/commands.js";
import {
  createUserAnswerResolution,
  createUserQuestionPayload,
} from "../helpers/pending-interactions.js";
import { textInput } from "../helpers/prompt-input.js";
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

function listTurnRequestTexts(harness: TestHarness, threadId: string) {
  return harness.db
    .select()
    .from(events)
    .where(
      and(
        eq(events.threadId, threadId),
        eq(events.type, "client/turn/requested"),
      ),
    )
    .orderBy(events.sequence)
    .all()
    .map((row) => {
      const data = turnRequestEventDataSchema.parse(JSON.parse(row.data));
      return {
        initiator: data.initiator,
        text: data.input
          .map((i) => (i.type === "text" ? i.text : `<${i.type}>`))
          .join(""),
      };
    });
}

// An "orchestrator" thread that is mid-turn and blocked on AskUserQuestion.
function seedBlockedOrchestrator(harness: TestHarness, tag: string) {
  const { host } = seedHostSession(harness.deps, { id: `host-${tag}` });
  const { project } = seedProjectWithSource(harness.deps, { hostId: host.id });
  const environment = seedEnvironment(harness.deps, {
    hostId: host.id,
    projectId: project.id,
    path: `/tmp/${tag}`,
  });
  const orchestrator = seedThread(harness.deps, {
    projectId: project.id,
    environmentId: environment.id,
    status: "active",
    title: "Orchestrator",
  });
  seedThreadRuntimeState(harness.deps, {
    threadId: orchestrator.id,
    environmentId: environment.id,
    providerThreadId: `provider-${tag}`,
    inputText: "Coordinate the workers",
    model: "fake-model",
  });
  seedTurnStarted(harness.deps, {
    threadId: orchestrator.id,
    turnId: `turn-${tag}`,
    providerThreadId: `provider-${tag}`,
  });
  const registered =
    harness.deps.pendingInteractions.registerPendingInteraction({
      interaction: {
        threadId: orchestrator.id,
        turnId: `turn-${tag}`,
        providerId: "codex",
        providerThreadId: `provider-${tag}`,
        providerRequestId: `request-${tag}`,
        payload: createUserQuestionPayload(),
      },
    });
  if (registered.outcome === "rejected") {
    throw new Error(`registration failed: ${registered.reason}`);
  }
  const worker = seedThread(harness.deps, {
    projectId: project.id,
    environmentId: environment.id,
    status: "idle",
    title: "Worker",
    parentThreadId: orchestrator.id,
  });
  return { orchestrator, worker, interactionId: registered.interaction.id };
}

describe("#1650 messages to a thread blocked on AskUserQuestion", () => {
  it("`bb thread tell` (steer-if-active) from a worker is refused with 409 and leaves no trace on the recipient", async () => {
    await withTestHarness(async (harness) => {
      const { orchestrator, worker } = seedBlockedOrchestrator(
        harness,
        "i1650-tell",
      );

      // What `bb thread tell <orchestrator> "report"` posts
      // (apps/cli/src/commands/thread/actions.ts postThreadMessage).
      const send = await harness.app.request(
        `/api/v1/threads/${orchestrator.id}/send`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode: "steer-if-active",
            input: [{ type: "text", text: "Worker report #1: done." }],
            senderThreadId: worker.id,
          }),
        },
      );
      console.log("[repro] send status:", send.status, await readJson(send));

      // Recipient-side: nothing. No queued row, no event, no counter.
      const queued = listQueuedThreadMessages(harness.db, orchestrator.id);
      const turnRequests = listTurnRequestTexts(harness, orchestrator.id);
      console.log("[repro] recipient queued rows:", queued.length);
      console.log("[repro] recipient turn requests:", turnRequests);

      // BUG: expected the recipient to retain the message somewhere.
      expect(
        queued.length +
          turnRequests.filter((r) => r.text.includes("Worker report")).length,
      ).toBeGreaterThan(0);
    });
  });

  it("`--mode queue` (queue-if-active) is ALSO refused with 409 while blocked", async () => {
    await withTestHarness(async (harness) => {
      const { orchestrator, worker } = seedBlockedOrchestrator(
        harness,
        "i1650-queue",
      );
      const send = await harness.app.request(
        `/api/v1/threads/${orchestrator.id}/send`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode: "queue-if-active",
            input: [{ type: "text", text: "Worker report #2: done." }],
            senderThreadId: worker.id,
          }),
        },
      );
      const body = await readJson(send);
      console.log("[repro] queue-if-active status:", send.status, body);
      // BUG: a queue request has no reason to be refused; it never touches the
      // running turn. Expected 200 + a queued row (that is what PR #112 removed).
      expect(send.status).toBe(200);
      expect(listQueuedThreadMessages(harness.db, orchestrator.id)).toHaveLength(
        1,
      );
    });
  });

  it("child completion notification to a blocked parent is dropped and never delivered after the question is answered", async () => {
    await withTestHarness(async (harness) => {
      const { orchestrator, interactionId } = seedBlockedOrchestrator(
        harness,
        "i1650-parent",
      );

      const delivered = await queueParentSystemMessage(harness.deps, {
        input: textInput("[bb system] @thread:thr_worker completed."),
        parentThreadId: orchestrator.id,
        systemMessageKind: "child-completed",
        systemMessageSubject: null,
      });
      console.log("[repro] queueParentSystemMessage returned:", delivered);

      // The human answers the question.
      const resolve = await harness.app.request(
        `/api/v1/threads/${orchestrator.id}/interactions/${interactionId}/resolve`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(createUserAnswerResolution()),
        },
      );
      console.log("[repro] resolve status:", resolve.status);
      // Play the host daemon: ack the interactive.resolve command so the
      // interaction reaches its terminal (resolved) state.
      const queuedResolve = await waitForQueuedCommand(
        harness,
        ({ command }) =>
          command.type === "interactive.resolve" &&
          command.interactionId === interactionId,
      );
      const ack = await reportQueuedCommandSuccess(harness, queuedResolve, {});
      console.log("[repro] daemon ack status:", ack.status);
      await new Promise((r) => setTimeout(r, 500));

      const turnRequests = listTurnRequestTexts(harness, orchestrator.id);
      console.log("[repro] parent turn requests after resolve:", turnRequests);
      // BUG: expected the child-completed notice to land once unblocked.
      expect(
        turnRequests.some(
          (r) => r.initiator === "system" && r.text.includes("completed"),
        ),
      ).toBe(true);
    });
  });

  it("(inconsistency) the dedicated queue route accepts a message for the same blocked thread", async () => {
    await withTestHarness(async (harness) => {
      const { orchestrator, worker } = seedBlockedOrchestrator(
        harness,
        "i1650-queue-route",
      );
      // `bb thread queue create` -> POST /threads/:id/queued-messages has no
      // pending-interaction guard, unlike `send` with mode queue-if-active.
      const create = await harness.app.request(
        `/api/v1/threads/${orchestrator.id}/queued-messages`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            input: [{ type: "text", text: "Worker report #4 via queue route." }],
            senderThreadId: worker.id,
          }),
        },
      );
      console.log("[repro] queued-messages route status:", create.status);
      expect(create.status).toBe(201);
      expect(listQueuedThreadMessages(harness.db, orchestrator.id)).toHaveLength(
        1,
      );
    });
  });
});
