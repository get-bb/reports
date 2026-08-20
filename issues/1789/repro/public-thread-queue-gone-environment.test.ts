import { getThread, listQueuedThreadMessages } from "@bb/db";
import {
  encodeClientTurnRequestIdNumber,
  threadScope,
  type EnvironmentStatus,
} from "@bb/domain";
import { describe, expect, it } from "vitest";
import { readJson } from "../helpers/json.js";
import {
  seedEnvironment,
  seedEvent,
  seedHostSession,
  seedProjectWithSource,
  seedThread,
} from "../helpers/seed.js";
import { withTestHarness } from "../helpers/test-app.js";

/**
 * Repro for get-bb/bb#1789.
 *
 * A direct send into a thread whose environment is destroying/destroyed is
 * rejected with 409 `thread_environment_unavailable` (see
 * public-thread-environment-decoupling.test.ts). The queued-message create
 * route has no such guard: it answers 201 with a queued-message id, the
 * thread keeps reporting `idle`, and the message can never drain because the
 * auto-send path throws the very 409 the create route should have returned.
 */
describe("queued message into a thread whose environment is gone (#1789)", () => {
  for (const status of [
    "destroying",
    "destroyed",
  ] as const satisfies readonly EnvironmentStatus[]) {
    it(`rejects queue-create when the environment is ${status} (currently accepts it)`, async () => {
      await withTestHarness(async (harness) => {
        const { host } = seedHostSession(harness.deps, {
          id: `host-queue-${status}`,
        });
        const { project } = seedProjectWithSource(harness.deps, {
          hostId: host.id,
        });
        const environment = seedEnvironment(harness.deps, {
          hostId: host.id,
          managed: true,
          projectId: project.id,
          path: null,
          status,
          workspaceProvisionType: "managed-worktree",
        });
        const thread = seedThread(harness.deps, {
          projectId: project.id,
          environmentId: environment.id,
          status: "idle",
        });

        // A prior accepted turn: the thread has a stored execution model and
        // a provider thread id, exactly like a real idle thread that ran once.
        seedEvent(harness.deps, {
          threadId: thread.id,
          environmentId: environment.id,
          sequence: 1,
          type: "client/turn/requested",
          scope: threadScope(),
          data: {
            direction: "outbound",
            requestId: encodeClientTurnRequestIdNumber({ value: 1 }),
            input: [{ type: "text", text: "Earlier work" }],
            target: { kind: "new-turn" },
            execution: {
              model: "gpt-5",
              serviceTier: "default",
              reasoningLevel: "medium",
              permissionMode: "full",
              source: "client/turn/requested",
            },
            initiator: "user",
            senderThreadId: null,
            request: { method: "turn/start", params: {} },
            source: "tell",
          },
        });

        // Control: the direct send path already refuses.
        const sendResponse = await harness.app.request(
          `/api/v1/threads/${thread.id}/send`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              mode: "auto",
              input: [{ type: "text", text: "direct send" }],
            }),
          },
        );
        expect(sendResponse.status).toBe(409);

        // Bug: the queue-create path accepts the same message.
        const queueResponse = await harness.app.request(
          `/api/v1/threads/${thread.id}/queued-messages`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              input: [{ type: "text", text: "queued into a gone env" }],
            }),
          },
        );
        const body = await readJson(queueResponse);

        // Thread record still claims to be a healthy idle worker.
        expect(getThread(harness.db, thread.id)?.status).toBe("idle");

        // EXPECTED (after fix): 409 thread_environment_unavailable and no
        // queued row. ACTUAL on c7c66423d: 201 + queued message id, and the
        // row sits in the queue forever.
        expect(
          queueResponse.status,
          `queue-create answered ${queueResponse.status} ${JSON.stringify(body)}; queued rows: ${
            listQueuedThreadMessages(harness.db, thread.id).length
          }`,
        ).toBe(409);
        expect(listQueuedThreadMessages(harness.db, thread.id)).toHaveLength(0);
      });
    });
  }
});
