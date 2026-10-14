import {
  getLastStoredProviderThreadId,
  listActiveBackgroundTaskCountsByThreadIds,
  listEvents,
  listOpenBackgroundTaskItemRowsForThread,
} from "@bb/db";
import { threadScope, turnScope } from "@bb/domain";
import {
  groupHostDaemonEvents,
  type HostDaemonEventEnvelope,
} from "@bb/host-daemon-contract";
import { expect, it } from "vitest";
import { editThreadMessage } from "../../src/services/threads/thread-edit-message.js";
import { internalAuthHeaders } from "../helpers/commands.js";
import { seedThreadFixture } from "../helpers/seed.js";
import { withTestHarness } from "../helpers/test-app.js";

it("settles an old-session background command when provider identity changes", async () => {
  await withTestHarness(async (harness) => {
    const { environment, session, thread } = seedThreadFixture(harness, {
      thread: { providerId: "claude-code", status: "idle" },
    });
    const providerThreadId = "repro-session-before";
    const postEvents = (events: HostDaemonEventEnvelope[]) =>
      harness.app.request("/internal/session/events", {
        method: "POST",
        headers: internalAuthHeaders(harness),
        body: JSON.stringify({
          sessionId: session.id,
          eventGroups: groupHostDaemonEvents(events),
        }),
      });
    const initial = await postEvents([
      {
        threadId: thread.id,
        event: {
          threadId: thread.id,
          type: "thread/identity",
          providerThreadId,
          scope: threadScope(),
        },
      },
      {
        threadId: thread.id,
        event: {
          threadId: thread.id,
          type: "turn/started",
          providerThreadId,
          scope: turnScope("repro-turn"),
        },
      },
      {
        threadId: thread.id,
        event: {
          threadId: thread.id,
          type: "item/started",
          providerThreadId,
          scope: turnScope("repro-turn"),
          item: {
            id: "repro-command",
            type: "backgroundTask",
            taskType: "local_bash",
            description: "fixture background command",
            status: "pending",
            taskStatus: "running",
            skipTranscript: false,
          },
        },
      },
      {
        threadId: thread.id,
        event: {
          threadId: thread.id,
          type: "turn/completed",
          providerThreadId,
          scope: turnScope("repro-turn"),
          status: "completed",
        },
      },
    ]);
    expect(initial.status).toBe(200);
    expect(
      listOpenBackgroundTaskItemRowsForThread(harness.db, {
        threadId: thread.id,
      }),
    ).toHaveLength(1);
    await expect(
      editThreadMessage(harness.deps, {
        environment,
        thread,
        payload: {
          operationId: "repro-edit",
          expectedRequestSequence: 1,
          input: [{ type: "text", text: "replacement", mentions: [] }],
        },
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: "Wait for background work to finish before editing the message",
    });
    const replacement = await postEvents([
      {
        threadId: thread.id,
        event: {
          threadId: thread.id,
          type: "thread/identity",
          providerThreadId: "repro-session-after",
          scope: threadScope(),
        },
      },
    ]);
    expect(replacement.status).toBe(200);
    expect(getLastStoredProviderThreadId(harness.db, thread.id)).toBe(
      "repro-session-after",
    );
    const completions = listEvents(harness.db, { threadId: thread.id }).filter(
      (event) => event.type === "item/backgroundTask/completed",
    );
    const activity = listActiveBackgroundTaskCountsByThreadIds(harness.db, {
      threadIds: [thread.id],
    });
    console.log(
      JSON.stringify({
        editGuard: 409,
        replacement: replacement.status,
        completionCount: completions.length,
        activeCommandCount: activity[0]?.activeBackgroundCommandCount ?? 0,
      }),
    );
    expect(completions).toHaveLength(1);
    expect(activity[0]?.activeBackgroundCommandCount ?? 0).toBe(0);
  });
});
