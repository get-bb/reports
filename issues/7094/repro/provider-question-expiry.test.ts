import { expect, it, vi } from "vitest";
import { createUserQuestionPayload } from "../helpers/pending-interactions.js";
import { createMockHubSocket } from "../helpers/mock-hub-socket.js";
import {
  seedEnvironment,
  seedHostSession,
  seedProjectWithSource,
  seedThread,
  seedTurnStarted,
} from "../helpers/seed.js";
import { withTestHarness } from "../helpers/test-app.js";

it("releases an unanswered native provider question after thirty minutes", async () => {
  await withTestHarness(async (harness) => {
    const { host, session } = seedHostSession(harness.deps);
    const { project } = seedProjectWithSource(harness.deps, { hostId: host.id });
    const environment = seedEnvironment(harness.deps, {
      hostId: host.id,
      projectId: project.id,
    });
    const thread = seedThread(harness.deps, {
      projectId: project.id,
      environmentId: environment.id,
      providerId: "claude-code",
    });
    const socket = createMockHubSocket();
    harness.deps.hub.registerDaemon(session.id, host.id, socket);
    const turnId = "turn-expiry-repro";
    const providerThreadId = "provider-thread-expiry-repro";
    seedTurnStarted(harness.deps, { threadId: thread.id, turnId, providerThreadId });
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    try {
      const created = harness.deps.pendingInteractions.registerPendingInteraction({
        interaction: {
          threadId: thread.id,
          turnId,
          providerId: "claude-code",
          providerThreadId,
          providerRequestId: "request-expiry-repro",
          payload: createUserQuestionPayload(),
        },
      });
      expect(created.outcome).toBe("created");
      if (created.outcome === "rejected") throw new Error(created.reason);
      expect(
        harness.deps.pendingInteractions.hasTurnBoundPendingThreadInteraction(thread.id),
      ).toBe(true);
      await vi.advanceTimersByTimeAsync(31 * 60 * 1000);
      const current = harness.deps.pendingInteractions.getThreadInteraction({
        threadId: thread.id,
        interactionId: created.interaction.id,
      });
      const blocksTurn =
        harness.deps.pendingInteractions.hasTurnBoundPendingThreadInteraction(thread.id);
      const endedRequests = socket.messages
        .map((message) => JSON.parse(message))
        .filter((message) => message.type === "interactive-requests.end");
      console.log("after 31 minutes", {
        status: current.status,
        expiresAt: current.expiresAt,
        blocksTurn,
        endedRequests: endedRequests.length,
      });
      expect(current.status).toBe("interrupted");
      expect(blocksTurn).toBe(false);
      expect(endedRequests).toHaveLength(1);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
});
