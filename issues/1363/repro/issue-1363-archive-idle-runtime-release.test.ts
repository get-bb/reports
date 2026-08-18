/**
 * Repro for get-bb/bb#1363 (provider process lifetime is not tied to thread
 * lifetime).
 *
 * Archiving an *idle* thread should end the thread's lease on its provider
 * process. On main that only happens for providers whose bridge declares
 * `threadArchive: true` (Codex -> `thread.archive`, which the codex bridge
 * turns into "kill this thread's app-server child"). For Claude Code / Pi /
 * ACP agents (`threadArchive: false`) the server dispatches nothing at all:
 * `requestActiveRuntimeThreadStopIfNeeded` only fires for active threads and
 * `dispatchSettledArchivedThreadProviderArchiveCommand` bails on the
 * capability. The `claude` child (~350 MiB RSS) therefore stays resident in
 * the host daemon with no active turn and no owner, and the idle reaper skips
 * it unless the `providerSessionReaping` experiment is on.
 *
 * Expected on a fixed build: every archive of a loaded idle thread dispatches a
 * runtime-release command (`thread.stop {intent:"release"}` or
 * `thread.archive`) to the host daemon.
 */
import { setTimeout as sleep } from "node:timers/promises";
import { describe, expect, it } from "vitest";
import { listQueuedThreadCommands } from "../helpers/commands.js";
import { seedThreadFixture, seedTurnStarted } from "../helpers/seed.js";
import { withTestHarness } from "../helpers/test-app.js";

async function archiveIdleThread(providerId: string) {
  return withTestHarness(async (harness) => {
    const { thread, environment } = seedThreadFixture(harness, {
      thread: { providerId, status: "idle" },
      environment: { status: "ready", path: `/tmp/issue-1363-${providerId}` },
    });
    // The thread ran before, so the daemon has a loaded provider session for it.
    seedTurnStarted(harness.deps, {
      threadId: thread.id,
      environmentId: environment.id,
      turnId: "turn-1",
      providerThreadId: `provider-${providerId}-1`,
    });

    const res = await harness.app.request(
      `/api/v1/threads/${thread.id}/archive`,
      { method: "POST" },
    );
    expect(res.status).toBe(200);
    // Give post-commit actions a tick to enqueue daemon commands.
    await sleep(100);

    const stops = listQueuedThreadCommands(harness, "thread.stop", thread.id);
    const discards = listQueuedThreadCommands(
      harness,
      "thread.archive",
      thread.id,
    );
    return { stops, discards };
  });
}

describe("issue #1363: archiving an idle thread releases its provider process", () => {
  it("codex: archive forwards a thread.archive (bridge kills the app-server)", async () => {
    const { stops, discards } = await archiveIdleThread("codex");
    expect(discards.length + stops.length).toBeGreaterThan(0);
  });

  it("claude-code: archive dispatches a runtime release (FAILS on main)", async () => {
    const { stops, discards } = await archiveIdleThread("claude-code");
    // On main both lists are empty: nothing tells the daemon to unload the
    // idle `claude` child, so it stays resident indefinitely.
    expect(discards.length + stops.length).toBeGreaterThan(0);
  });
});
