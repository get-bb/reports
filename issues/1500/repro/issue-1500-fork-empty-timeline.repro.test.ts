/**
 * Repro for get-bb/bb#1500 — "Forked threads have an empty timeline".
 *
 * Both assertions below FAIL on main (16ceb3a54):
 *   1. `thread.start.fork` carries only `sourceProviderThreadId`; the
 *      requested `sourceSeqEnd` is not translated into the source turn's
 *      recorded `providerCheckpointId`, so a checkpoint-capable provider (pi)
 *      clones the whole session tip regardless of `sourceSeqEnd`.
 *   2. No source events (or any projection of them) are written to the fork,
 *      so `GET /threads/:id/timeline` returns zero rows.
 */
import { turnScope } from "@bb/domain";
import { threadResponseSchema } from "@bb/server-contract";
import { describe, expect, it } from "vitest";
import { waitForQueuedCommand } from "../helpers/commands.js";
import { readJson } from "../helpers/json.js";
import {
  seedEnvironment,
  seedEvent,
  seedHostSession,
  seedProjectWithSource,
  seedThread,
  seedThreadRuntimeState,
  seedTurnStarted,
} from "../helpers/seed.js";
import { withTestHarness, type TestAppHarness } from "../helpers/test-app.js";

const PROVIDER_THREAD_ID = "pi-source-session";

/** Source thread with two completed turns; turn 1 ends at sequence 5. */
function seedTwoTurnSource(harness: TestAppHarness) {
  const { host } = seedHostSession(harness.deps);
  const { project } = seedProjectWithSource(harness.deps, {
    hostId: host.id,
    path: "/tmp/issue-1500",
  });
  const environment = seedEnvironment(harness.deps, {
    hostId: host.id,
    projectId: project.id,
    path: "/tmp/issue-1500",
  });
  const sourceThread = seedThread(harness.deps, {
    environmentId: environment.id,
    projectId: project.id,
  });
  // seq 1: thread/identity, seq 2: client/turn/requested ("Prior task")
  seedThreadRuntimeState(harness.deps, {
    environmentId: environment.id,
    inputText: "Reply only with ok.",
    permissionMode: "full",
    providerThreadId: PROVIDER_THREAD_ID,
    threadId: sourceThread.id,
  });
  const base = {
    environmentId: environment.id,
    providerThreadId: PROVIDER_THREAD_ID,
    threadId: sourceThread.id,
  };
  // Turn 1: seq 3..5
  seedTurnStarted(harness.deps, { ...base, sequence: 3, turnId: "turn-1" });
  seedEvent(harness.deps, {
    ...base,
    sequence: 4,
    type: "item/completed",
    scope: turnScope("turn-1"),
    data: {
      providerThreadId: PROVIDER_THREAD_ID,
      item: { type: "agentMessage", id: "msg-1", text: "ok" },
    },
  });
  seedEvent(harness.deps, {
    ...base,
    sequence: 5,
    type: "turn/completed",
    scope: turnScope("turn-1"),
    data: {
      providerThreadId: PROVIDER_THREAD_ID,
      status: "completed",
      providerCheckpointId: "pi-entry-after-turn-1",
    },
  });
  // Turn 2: seq 6..8
  seedTurnStarted(harness.deps, { ...base, sequence: 6, turnId: "turn-2" });
  seedEvent(harness.deps, {
    ...base,
    sequence: 7,
    type: "item/completed",
    scope: turnScope("turn-2"),
    data: {
      providerThreadId: PROVIDER_THREAD_ID,
      item: { type: "agentMessage", id: "msg-2", text: "second" },
    },
  });
  seedEvent(harness.deps, {
    ...base,
    sequence: 8,
    type: "turn/completed",
    scope: turnScope("turn-2"),
    data: {
      providerThreadId: PROVIDER_THREAD_ID,
      status: "completed",
      providerCheckpointId: "pi-entry-after-turn-2",
    },
  });
  return { sourceThread };
}

describe("issue #1500 — fork timeline / sourceSeqEnd", () => {
  it("passes the source checkpoint for sourceSeqEnd and clones the source timeline", async () => {
    await withTestHarness(async (harness) => {
      const { sourceThread } = seedTwoTurnSource(harness);

      const response = await harness.app.request("/api/v1/threads/fork", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceThreadId: sourceThread.id,
          sourceSeqEnd: 5,
          workspace: "reuse",
        }),
      });
      expect(response.status).toBe(201);
      const fork = threadResponseSchema.parse(await readJson(response));

      const queued = await waitForQueuedCommand(
        harness,
        ({ command }) =>
          command.type === "thread.start" && command.threadId === fork.id,
      );
      if (queued.command.type !== "thread.start") {
        throw new Error("Expected thread.start");
      }
      // (1) FAILS on main: fork === { sourceProviderThreadId } — the
      // checkpoint recorded on the seq-5 turn/completed is dropped, so the
      // daemon/bridge clones the tip (turn 2 included).
      expect.soft(queued.command.fork).toEqual({
        sourceProviderThreadId: PROVIDER_THREAD_ID,
        sourceProviderCheckpointId: "pi-entry-after-turn-1",
      });

      // (2) FAILS on main: the fork's timeline is empty.
      const timelineResponse = await harness.app.request(
        `/api/v1/threads/${fork.id}/timeline`,
      );
      expect(timelineResponse.status).toBe(200);
      const timeline = (await readJson(timelineResponse)) as {
        rows: Array<{ kind: string; text?: string }>;
      };
      const texts = timeline.rows
        .filter((row) => row.kind === "conversation")
        .map((row) => row.text);
      expect(texts).toEqual(["Reply only with ok.", "ok"]);
    });
  });
});
