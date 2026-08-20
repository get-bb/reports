// Repro for get-bb/bb#1924: archiving a thread fails with 409 once its
// environment row has been pruned by pruneDestroyedEnvironments.
import { environments, getThread, pruneDestroyedEnvironments } from "@bb/db";
import { apiErrorSchema } from "@bb/server-contract";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { readJson } from "../helpers/json.js";
import {
  seedEnvironment,
  seedHostSession,
  seedProjectWithSource,
  seedThread,
} from "../helpers/seed.js";
import { withTestHarness } from "../helpers/test-app.js";

const EIGHT_DAYS_MS = 8 * 24 * 60 * 60_000;

function seedThreadWithPrunedEnvironment(
  deps: Parameters<typeof seedThread>[0],
) {
  const { host } = seedHostSession(deps);
  const { project } = seedProjectWithSource(deps, { hostId: host.id });
  const environment = seedEnvironment(deps, {
    hostId: host.id,
    projectId: project.id,
    managed: true,
    workspaceProvisionType: "managed-worktree",
  });
  const thread = seedThread(deps, {
    environmentId: environment.id,
    projectId: project.id,
    status: "idle",
  });

  // Issue step 2: the environment is destroyed while the thread stays
  // unarchived. Step 3: the 7-day TTL elapses (updated_at set back 8 days).
  deps.db
    .update(environments)
    .set({ status: "destroyed", updatedAt: Date.now() - EIGHT_DAYS_MS })
    .where(eq(environments.id, environment.id))
    .run();

  const pruned = pruneDestroyedEnvironments(deps.db, deps.hub);
  expect(pruned.deleted).toBe(1);

  // threads.environment_id is ON DELETE SET NULL: the pointer is stripped from
  // the still-live thread.
  const threadAfterPrune = getThread(deps.db, thread.id);
  expect(threadAfterPrune?.environmentId).toBeNull();
  expect(threadAfterPrune?.archivedAt).toBeNull();

  return { host, project, thread, environmentId: environment.id };
}

describe("issue #1924: archive after environment prune", () => {
  it("pruneDestroyedEnvironments deletes an environment that still has a live thread", async () => {
    await withTestHarness(async (harness) => {
      // The helper asserts deleted === 1 and environmentId === null.
      seedThreadWithPrunedEnvironment(harness.deps);
    });
  });

  it("POST /threads/:id/archive succeeds for a thread whose environment was pruned", async () => {
    await withTestHarness(async (harness) => {
      const { thread } = seedThreadWithPrunedEnvironment(harness.deps);

      const response = await harness.app.request(
        `/api/v1/threads/${thread.id}/archive`,
        { method: "POST" },
      );
      const body = await readJson(response);
      // BUG on c7c66423d: status is 409 with
      // {"code":"thread_environment_unavailable","details":{"reason":"never_attached"}}
      if (response.status !== 200) {
        const error = apiErrorSchema.parse(body);
        console.log(
          "archive response:",
          response.status,
          JSON.stringify(error),
        );
      }
      expect(response.status).toBe(200);
      expect(getThread(harness.deps.db, thread.id)?.archivedAt).not.toBeNull();
    });
  });

  it("POST /threads/:id/archive-all succeeds for a thread whose environment was pruned", async () => {
    await withTestHarness(async (harness) => {
      const { thread } = seedThreadWithPrunedEnvironment(harness.deps);

      const response = await harness.app.request(
        `/api/v1/threads/${thread.id}/archive-all`,
        { method: "POST" },
      );
      const body = await readJson(response);
      if (response.status !== 200) {
        console.log(
          "archive-all response:",
          response.status,
          JSON.stringify(body),
        );
      }
      expect(response.status).toBe(200);
      expect(getThread(harness.deps.db, thread.id)?.archivedAt).not.toBeNull();
    });
  });

  it("DELETE /threads/:id (the only workaround) succeeds for the same thread", async () => {
    await withTestHarness(async (harness) => {
      const { thread } = seedThreadWithPrunedEnvironment(harness.deps);
      const response = await harness.app.request(
        `/api/v1/threads/${thread.id}`,
        {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ childThreadsConfirmed: false }),
        },
      );
      expect(response.status).toBe(200);
    });
  });
});
