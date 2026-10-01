import { listEvents, listQueuedThreadMessages } from "@bb/db";
import { turnRequestEventDataSchema } from "@bb/domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverParentSystemMessage } from "../../src/services/threads/parent-system-messages.js";
import { runQueuedMessageDispatch } from "../../src/services/threads/queued-message-dispatch.js";
import { acceptThreadSendRequest } from "../../src/services/threads/thread-send-request.js";
import { textInput } from "../helpers/prompt-input.js";
import {
  seedEnvironment,
  seedHostSession,
  seedProjectWithSource,
  seedThread,
  seedThreadRuntimeState,
  seedTurnStarted,
} from "../helpers/seed.js";
import { withTestHarness, type TestAppHarness } from "../helpers/test-app.js";

afterEach(() => vi.useRealTimers());

function seedActiveThread(harness: TestAppHarness) {
  const { host } = seedHostSession(harness.deps, { id: "host-scheduled-provenance" });
  const { project } = seedProjectWithSource(harness.deps, {
    hostId: host.id,
    path: "/tmp/scheduled-provenance-project",
  });
  const environment = seedEnvironment(harness.deps, {
    hostId: host.id,
    projectId: project.id,
    path: "/tmp/scheduled-provenance-project",
  });
  const thread = seedThread(harness.deps, {
    environmentId: environment.id,
    projectId: project.id,
    status: "active",
  });
  seedThreadRuntimeState(harness.deps, {
    environmentId: environment.id,
    providerThreadId: "provider-scheduled-provenance",
    threadId: thread.id,
  });
  seedTurnStarted(harness.deps, {
    environmentId: environment.id,
    threadId: thread.id,
    turnId: "turn-scheduled-provenance",
    providerThreadId: "provider-scheduled-provenance",
  });
  return thread;
}

function requests(harness: TestAppHarness, threadId: string) {
  return listEvents(harness.db, { threadId }).filter(
    (event) => event.type === "client/turn/requested",
  );
}

describe("scheduled active-thread dispatch", () => {
  it("retains a future row across automatic wakes and a child notice, then sends when due", async () => {
    await withTestHarness(async (harness) => {
      const thread = seedActiveThread(harness);
      vi.useFakeTimers({ toFake: ["Date"] });
      const now = Date.UTC(2026, 0, 15, 12);
      vi.setSystemTime(now);
      const sendAt = now + 60_000;
      const result = await acceptThreadSendRequest(harness.deps, {
        thread,
        payload: { input: textInput("scheduled probe"), mode: "steer-if-active", sendAt },
      });
      expect(result.delivery).toBe("queued");
      const queued = listQueuedThreadMessages(harness.db, thread.id);
      expect(queued).toHaveLength(1);
      expect(result).toMatchObject({
        delivery: "queued",
        queuedMessage: {
          sendAt,
          waitingOn: { kind: "time" },
          groupWithNext: false,
          failureReason: null,
        },
      });
      const before = requests(harness, thread.id).length;
      for (const kind of ["thread-ready", "turn-started", "workspace-ready", "interaction-settled"] as const) {
        await runQueuedMessageDispatch(harness.deps, { kind, threadId: thread.id });
      }
      await runQueuedMessageDispatch(harness.deps, { kind: "time-reached", now });
      await runQueuedMessageDispatch(harness.deps, { kind: "plugin-recheck" });
      expect(requests(harness, thread.id)).toHaveLength(before);
      expect(listQueuedThreadMessages(harness.db, thread.id)).toEqual(queued);
      expect(await deliverParentSystemMessage(harness.deps, {
        parentThread: thread,
        input: textInput("child completion probe"),
        systemMessageKind: "child-completed",
        systemMessageSubject: { kind: "thread", threadId: "thr_child_probe", threadName: "Probe child" },
      })).toBe(true);
      expect(requests(harness, thread.id)).toHaveLength(before + 1);
      expect(listQueuedThreadMessages(harness.db, thread.id)).toEqual(queued);
      vi.setSystemTime(sendAt);
      await runQueuedMessageDispatch(harness.deps, { kind: "time-reached", now: sendAt });
      expect(listQueuedThreadMessages(harness.db, thread.id)).toEqual([]);
      expect(requests(harness, thread.id)).toHaveLength(before + 2);
      expect(turnRequestEventDataSchema.parse(JSON.parse(requests(harness, thread.id).at(-1)!.data))).toMatchObject({ input: textInput("scheduled probe") });
    });
  });

  it("allows explicit promotion before the deadline but loses the queue provenance", async () => {
    await withTestHarness(async (harness) => {
      const thread = seedActiveThread(harness);
      vi.useFakeTimers({ toFake: ["Date"] });
      const now = Date.UTC(2026, 0, 15, 12);
      vi.setSystemTime(now);
      const sendAt = now + 60_000;
      await acceptThreadSendRequest(harness.deps, {
        thread,
        payload: { input: textInput("promotion probe"), mode: "steer-if-active", sendAt },
      });
      const queued = listQueuedThreadMessages(harness.db, thread.id);
      expect(queued).toHaveLength(1);
      const response = await harness.app.request(
        `/api/v1/threads/${thread.id}/queued-messages/${queued[0]!.id}/send`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "steer" }) },
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ ok: true, delivery: "sent" });
      expect(Date.now()).toBeLessThan(sendAt);
      expect(listQueuedThreadMessages(harness.db, thread.id)).toEqual([]);
      const event = requests(harness, thread.id).at(-1);
      const data = turnRequestEventDataSchema.parse(JSON.parse(event!.data));
      expect(data).toMatchObject({ input: textInput("promotion probe") });
      const serialized = event!.data;
      console.log("promotion evidence", JSON.stringify({
        dispatchedBeforeDue: Date.now() < sendAt,
        queueRowsRemaining: listQueuedThreadMessages(harness.db, thread.id).length,
        containsQueuedId: serialized.includes(queued[0]!.id),
        containsOriginalSendAt: serialized.includes(String(sendAt)),
        requestDataKeys: Object.keys(data).sort(),
      }));
      expect(serialized, "delivery must retain the original queued message id").toContain(queued[0]!.id);
    });
  });
});
