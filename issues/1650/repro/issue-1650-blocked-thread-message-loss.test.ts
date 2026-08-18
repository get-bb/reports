// Repro for get-bb/bb#1650: messages addressed to a thread that is blocked on a
// pending user interaction (AskUserQuestion / approval) are lost. Two paths:
//
//  1. POST /threads/:id/send (what `bb thread tell` uses) returns 409 and
//     persists nothing, so the recipient thread never learns a message existed.
//  2. queueParentSystemMessage (child completed/failed/interrupted notices)
//     returns false without logging or persisting anything, so a blocked
//     orchestrator never hears that its worker finished.
//
// Both tests assert the DESIRED behaviour (message retained somewhere the
// recipient can see) and therefore FAIL on main 16ceb3a54.
import { and, eq } from "drizzle-orm";
import { events, listQueuedThreadMessages } from "@bb/db";
import { turnRequestEventDataSchema } from "@bb/domain";
import { describe, expect, it } from "vitest";
import { queueParentSystemMessage } from "../../src/services/threads/parent-system-messages.js";
import { readJson } from "../helpers/json.js";
import { createUserQuestionPayload } from "../helpers/pending-interactions.js";
import {
  seedEnvironment,
  seedHostSession,
  seedProjectWithSource,
  seedThread,
  seedThreadRuntimeState,
  seedTurnStarted,
} from "../helpers/seed.js";
import { withTestHarness } from "../helpers/test-app.js";

describe("issue #1650: messages to a thread blocked on AskUserQuestion", () => {
  it("bb thread tell to a blocked active thread is retained (queued), not dropped with 409", async () => {
    await withTestHarness(async (harness) => {
      const { host } = seedHostSession(harness.deps, { id: "host-1650-send" });
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
      });
      const environment = seedEnvironment(harness.deps, {
        hostId: host.id,
        projectId: project.id,
        path: "/tmp/issue-1650",
      });
      const orchestrator = seedThread(harness.deps, {
        projectId: project.id,
        environmentId: environment.id,
        status: "active",
        title: "Orchestrator",
      });
      const worker = seedThread(harness.deps, {
        projectId: project.id,
        environmentId: environment.id,
        title: "Worker",
        parentThreadId: orchestrator.id,
      });
      seedThreadRuntimeState(harness.deps, {
        threadId: orchestrator.id,
        environmentId: environment.id,
        providerThreadId: "provider-1650",
        inputText: "Orchestrate",
        model: "fake-model",
      });
      seedTurnStarted(harness.deps, {
        threadId: orchestrator.id,
        turnId: "turn-1650",
        providerThreadId: "provider-1650",
      });
      const registered =
        harness.deps.pendingInteractions.registerPendingInteraction({
          interaction: {
            threadId: orchestrator.id,
            turnId: "turn-1650",
            providerId: "codex",
            providerThreadId: "provider-1650",
            providerRequestId: "req-1650",
            payload: createUserQuestionPayload(),
          },
        });
      expect(registered.outcome).toBe("created");

      // The worker reports back, exactly like `bb thread tell <orchestrator>`
      // from inside the worker (default mode is steer-if-active).
      const response = await harness.app.request(
        `/api/v1/threads/${orchestrator.id}/send`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode: "steer-if-active",
            senderThreadId: worker.id,
            input: [{ type: "text", text: "worker report: task done" }],
          }),
        },
      );
      const body = await readJson(response);
      // On main: status 409 {code:"awaiting_user_interaction"} and nothing is
      // persisted for the orchestrator.
      const queued = listQueuedThreadMessages(harness.db, orchestrator.id);
      const turnRequests = harness.db
        .select()
        .from(events)
        .where(
          and(
            eq(events.threadId, orchestrator.id),
            eq(events.type, "client/turn/requested"),
          ),
        )
        .all();
      expect(
        {
          status: response.status,
          body,
          queuedRows: queued.length,
          turnRequests: turnRequests.length,
        },
        "the message must land somewhere the orchestrator can see it",
      ).toMatchObject({ status: 200 });
      expect(queued.length + turnRequests.length).toBeGreaterThan(0);
    });
  });

  it("a child-completed notice to a blocked parent is not silently discarded", async () => {
    await withTestHarness(async (harness) => {
      const { host } = seedHostSession(harness.deps, { id: "host-1650-parent" });
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
      });
      const environment = seedEnvironment(harness.deps, {
        hostId: host.id,
        projectId: project.id,
        path: "/tmp/issue-1650-parent",
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
        providerThreadId: "provider-1650-parent",
        inputText: "Manage things",
        model: "fake-model",
      });
      seedTurnStarted(harness.deps, {
        threadId: parent.id,
        turnId: "turn-1650-parent",
        providerThreadId: "provider-1650-parent",
      });
      const registered =
        harness.deps.pendingInteractions.registerPendingInteraction({
          interaction: {
            threadId: parent.id,
            turnId: "turn-1650-parent",
            providerId: "codex",
            providerThreadId: "provider-1650-parent",
            providerRequestId: "req-1650-parent",
            payload: createUserQuestionPayload(),
          },
        });
      expect(registered.outcome).toBe("created");

      const delivered = await queueParentSystemMessage(harness.deps, {
        input: [{ type: "text", text: "[bb system] child completed", mentions: [] }],
        parentThreadId: parent.id,
        systemMessageKind: "child-completed",
        systemMessageSubject: null,
      });

      const systemTurnRequests = harness.db
        .select()
        .from(events)
        .where(
          and(
            eq(events.threadId, parent.id),
            eq(events.type, "client/turn/requested"),
          ),
        )
        .all()
        .filter(
          (row) =>
            turnRequestEventDataSchema.parse(JSON.parse(row.data)).initiator ===
            "system",
        );
      // On main: delivered === false and no row exists anywhere; the notice is
      // gone for good, and nothing is logged.
      expect({ delivered, persistedSystemTurnRequests: systemTurnRequests.length })
        .not.toEqual({ delivered: false, persistedSystemTurnRequests: 0 });
    });
  });
});
