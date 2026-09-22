import { setTimeout as sleep } from "node:timers/promises";
import { events, getThread } from "@bb/db";
import { turnScope } from "@bb/domain";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { interruptActiveThreadsForHost } from "../../src/services/threads/thread-lifecycle.js";
import { queueChildThreadTurnNotificationBestEffort } from "../../src/services/threads/child-thread-notifications.js";
import { listQueuedThreadCommands } from "../helpers/commands.js";
import { seedEnvironment, seedEvent, seedHostSession, seedProjectWithSource, seedThread, seedThreadRuntimeState } from "../helpers/seed.js";
import { withTestHarness } from "../helpers/test-app.js";

it.each(["host-daemon-restarted", "manual-stop", "control"] as const)("parent delivery after %s", async (mode) => {
  await withTestHarness(async (harness) => {
    const { host } = seedHostSession(harness.deps);
    const { project } = seedProjectWithSource(harness.deps, { hostId: host.id });
    const parentEnv = seedEnvironment(harness.deps, { hostId: host.id, projectId: project.id });
    const childHost = seedHostSession(harness.deps).host;
    const childEnv = seedEnvironment(harness.deps, { hostId: childHost.id, projectId: project.id });
    const parent = seedThread(harness.deps, { projectId: project.id, environmentId: parentEnv.id, providerId: "codex", status: "idle" });
    seedThreadRuntimeState(harness.deps, { threadId: parent.id, environmentId: parentEnv.id, providerThreadId: "parent-provider" });
    const child = seedThread(harness.deps, { projectId: project.id, environmentId: childEnv.id, parentThreadId: parent.id, providerId: "codex", status: "active" });
    seedEvent(harness.deps, { threadId: child.id, environmentId: childEnv.id, providerThreadId: "child-provider", sequence: 1, type: "turn/started", scope: turnScope("child-turn"), data: { providerThreadId: "child-provider" } });
    if (mode === "control") {
      await queueChildThreadTurnNotificationBestEffort(harness.deps, { childThread: child, parentThreadId: parent.id, turnStatus: "interrupted" });
    } else {
      const result = interruptActiveThreadsForHost(harness.deps, { hostId: childHost.id, reason: mode, ...(mode === "host-daemon-restarted" ? { cause: "host-connection-lost" as const } : {}) });
      expect(result.threads).toHaveLength(1);
      expect(result.threads[0]?.interruptedTurnId).toBe("child-turn");
      if (mode === "host-daemon-restarted") expect(getThread(harness.db, child.id)?.status).toBe("error");
      const childEvents = harness.db.select().from(events).where(eq(events.threadId, child.id)).all();
      expect(childEvents.some((event) => event.type === "turn/completed")).toBe(true);
      expect(childEvents.some((event) => event.type === "system/thread/interrupted")).toBe(true);
    }
    await sleep(2300);
    const delivered = listQueuedThreadCommands(harness, "turn.submit", parent.id);
    expect(delivered).toHaveLength(mode === "manual-stop" ? 0 : 1);
  });
});
