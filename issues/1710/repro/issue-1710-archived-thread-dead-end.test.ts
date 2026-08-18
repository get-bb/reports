import { eq } from "drizzle-orm";
import {
  archiveThread,
  createEnvironment,
  createThread,
  environments,
  getEnvironment,
  getThread,
} from "@bb/db";
import { describe, expect, it } from "vitest";
import { MANAGED_ENVIRONMENT_RETIRE_GRACE_MS } from "../../src/constants.js";
import { settleEnvironmentDestroyCommandResult } from "../../src/services/environments/environment-cleanup-internal.js";
import { runManagedEnvironmentArchiveCleanupRecoverySweep } from "../../src/services/system/periodic-sweeps.js";
import { listQueuedEnvironmentCommands } from "../helpers/commands.js";
import { readJson } from "../helpers/json.js";
import { seedHostSession, seedProjectWithSource } from "../helpers/seed.js";
import { withTestHarness } from "../helpers/test-app.js";

const SWEEP_START_MS = 4_000_000_000_000;

/**
 * Issue #1710: a thread archived by accident becomes unrecoverable once its
 * managed worktree's 5-minute grace window elapses. This test PASSES on main:
 * it documents the dead end, not a crash. After the destroy settles the
 * environment is `destroyed` (terminal), `unarchive` returns 200 but the
 * thread stays read-only (send -> 409 thread_environment_unavailable) and
 * nothing in the API can re-provision a workspace for the thread.
 */
describe("issue #1710: archived thread cannot resume after grace expiry", () => {
  it("unarchive succeeds but the thread is permanently unwritable once its environment was destroyed", async () => {
    await withTestHarness(async (harness) => {
      const { host } = seedHostSession(harness.deps);
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
      });
      const environment = createEnvironment(harness.db, harness.hub, {
        hostId: host.id,
        isGitRepo: true,
        managed: true,
        path: "/tmp/issue-1710-worktree",
        projectId: project.id,
        status: "ready",
        workspaceProvisionType: "managed-worktree",
      });
      const thread = createThread(harness.db, harness.hub, {
        projectId: project.id,
        environmentId: environment.id,
        providerId: "codex",
        status: "idle",
      });

      // 1. Archive the only live thread of the managed worktree -> the
      //    environment enters `retiring` (5-minute grace window).
      const archiveResponse = await harness.app.request(
        `/api/v1/threads/${thread.id}/archive`,
        { method: "POST" },
      );
      expect(archiveResponse.status).toBe(200);
      expect(getThread(harness.db, thread.id)?.archivedAt).not.toBeNull();
      expect(getEnvironment(harness.db, environment.id)?.status).toBe(
        "retiring",
      );

      // 2. Inside the grace window unarchive is lossless: retire.cancelled.
      //    (Control: this is what the user gets if they notice within 5 min.)
      await runManagedEnvironmentArchiveCleanupRecoverySweep(
        harness.deps,
        SWEEP_START_MS,
      );
      expect(getEnvironment(harness.db, environment.id)?.status).toBe(
        "retiring",
      );

      // 3. The user does not notice for > 5 minutes. Simulate the elapsed
      //    grace window exactly the way the periodic sweep sees it.
      archiveThread(harness.db, harness.hub, thread.id);
      harness.db
        .update(environments)
        .set({
          retireRequestedAt:
            Date.now() - MANAGED_ENVIRONMENT_RETIRE_GRACE_MS - 1,
        })
        .where(eq(environments.id, environment.id))
        .run();
      await runManagedEnvironmentArchiveCleanupRecoverySweep(
        harness.deps,
        SWEEP_START_MS + 1,
      );
      expect(getEnvironment(harness.db, environment.id)?.status).toBe(
        "destroying",
      );
      const destroyCommands = listQueuedEnvironmentCommands(
        harness,
        "environment.destroy",
        environment.id,
      );
      expect(destroyCommands).toHaveLength(1);

      // 4. The host daemon reports the worktree removed -> `destroyed`
      //    (terminal state, path cleared).
      const destroyAttemptId = getEnvironment(harness.db, environment.id)
        ?.destroyAttemptId;
      expect(destroyAttemptId).toBeTruthy();
      harness.db.transaction((tx) => {
        settleEnvironmentDestroyCommandResult({
          command: {
            type: "environment.destroy",
            environmentId: environment.id,
            workspaceContext: {
              workspacePath: "/tmp/issue-1710-worktree",
              workspaceProvisionType: "managed-worktree",
            },
          },
          deps: { ...harness.deps, db: tx, hub: harness.hub },
          execution: {
            createdAt: Date.now(),
            hostId: host.id,
            id: destroyAttemptId!,
          },
          report: { ok: true, result: {} },
        });
      });
      expect(getEnvironment(harness.db, environment.id)).toMatchObject({
        status: "destroyed",
        path: null,
      });

      // 5. The user finds the thread and clicks Unarchive (sidebar menu /
      //    settings > archived threads; the in-thread banner hides the button).
      const unarchiveResponse = await harness.app.request(
        `/api/v1/threads/${thread.id}/unarchive`,
        { method: "POST" },
      );
      expect(unarchiveResponse.status).toBe(200);
      expect(getThread(harness.db, thread.id)?.archivedAt).toBeNull();
      // The environment is not revived: `retire.cancelled` is illegal from
      // `destroyed`, and nothing re-provisions.
      expect(getEnvironment(harness.db, environment.id)?.status).toBe(
        "destroyed",
      );

      // 6. The thread is now live-but-dead: every attempt to continue the
      //    conversation is rejected, and there is no route that would attach a
      //    fresh workspace. This is the "cannot continue the original chat"
      //    state from the issue.
      const sendResponse = await harness.app.request(
        `/api/v1/threads/${thread.id}/send`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode: "auto",
            input: [{ type: "text", text: "Reply only with ok." }],
          }),
        },
      );
      expect(sendResponse.status).toBe(409);
      expect(await readJson(sendResponse)).toMatchObject({
        code: "thread_environment_unavailable",
        details: { reason: "destroyed", environmentStatus: "destroyed" },
      });
    });
  });
});
