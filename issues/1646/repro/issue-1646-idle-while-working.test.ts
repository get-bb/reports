/**
 * Repro for get-bb/bb#1646: a thread reports `idle` while the provider keeps
 * streaming root work (commandExecution etc.) on a turn it already reported as
 * completed. bb derives thread status only from root turn/started and
 * turn/completed, so post-completion work on an already-started turn is stored
 * (it passes the stored-turn/started guard) but never flips the thread back to
 * `active`.
 *
 * On main (16ceb3a54) the assertion `expect(status).toBe("active")` FAILS with
 * "idle" — that is the bug. On PR #1697 it passes.
 */
import { getThread } from "@bb/db";
import { turnScope } from "@bb/domain";
import {
  groupHostDaemonEvents,
  type HostDaemonEventEnvelope,
} from "@bb/host-daemon-contract";
import { describe, expect, it } from "vitest";
import { internalAuthHeaders } from "../helpers/commands.js";
import {
  seedEnvironment,
  seedHostSession,
  seedProjectWithSource,
  seedThread,
} from "../helpers/seed.js";
import { createTestAppHarness } from "../helpers/test-app.js";

async function setup() {
  const harness = await createTestAppHarness();
  const { host, session } = seedHostSession(harness.deps, {});
  const { project } = seedProjectWithSource(harness.deps, { hostId: host.id });
  const environment = seedEnvironment(harness.deps, {
    hostId: host.id,
    projectId: project.id,
  });
  const thread = seedThread(harness.deps, {
    projectId: project.id,
    environmentId: environment.id,
    status: "active",
  });
  const post = (events: HostDaemonEventEnvelope[]) =>
    harness.app.request("/internal/session/events", {
      method: "POST",
      headers: internalAuthHeaders(harness),
      body: JSON.stringify({
        sessionId: session.id,
        eventGroups: groupHostDaemonEvents(events),
      }),
    });
  return { harness, thread, post };
}

const PROVIDER_THREAD_ID = "codex-thread-1646";

function turnStarted(threadId: string, turnId: string): HostDaemonEventEnvelope {
  return {
    threadId,
    event: {
      type: "turn/started",
      threadId,
      providerThreadId: PROVIDER_THREAD_ID,
      scope: turnScope(turnId),
    },
  };
}

function turnCompleted(
  threadId: string,
  turnId: string,
): HostDaemonEventEnvelope {
  return {
    threadId,
    event: {
      type: "turn/completed",
      threadId,
      providerThreadId: PROVIDER_THREAD_ID,
      scope: turnScope(turnId),
      status: "completed",
    },
  };
}

function commandStarted(
  threadId: string,
  turnId: string,
  id: string,
  command: string,
): HostDaemonEventEnvelope {
  return {
    threadId,
    event: {
      type: "item/started",
      threadId,
      providerThreadId: PROVIDER_THREAD_ID,
      scope: turnScope(turnId),
      item: {
        type: "commandExecution",
        id,
        command,
        cwd: "/repo",
        status: "pending",
        approvalStatus: null,
      },
    },
  };
}

describe("issue #1646: provider keeps working after turn/completed", () => {
  it("thread stays idle while root commandExecution items stream on the completed turn", async () => {
    const { harness, thread, post } = await setup();
    try {
      // 22:13:59 turn/started, 22:14:36 turn/completed -> thread idle
      let res = await post([
        turnStarted(thread.id, "turn-X"),
        turnCompleted(thread.id, "turn-X"),
      ]);
      expect(res.status).toBe(200);
      expect(getThread(harness.db, thread.id)?.status).toBe("idle");

      // 22:14:48.. work resumes on the SAME turn id. It is accepted (200): the
      // stored-turn/started guard is satisfied because turn-X was started.
      res = await post([
        commandStarted(thread.id, "turn-X", "cmd-1", "npm test"),
        commandStarted(thread.id, "turn-X", "cmd-2", "rtk npm run typecheck"),
      ]);
      expect(res.status).toBe(200);

      // BUG: the thread is executing commands but reports idle.
      expect(getThread(harness.db, thread.id)?.status).toBe("active");
    } finally {
      await harness.cleanup();
    }
  });

  it("control: work scoped to a never-started turn is rejected with 409, so the idle-gap items must have used a started turn id", async () => {
    const { harness, thread, post } = await setup();
    try {
      const res = await post([
        commandStarted(thread.id, "turn-never-started", "cmd-1", "npm test"),
      ]);
      expect(res.status).toBe(409);
    } finally {
      await harness.cleanup();
    }
  });
});
