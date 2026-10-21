import { getThread } from "@bb/db";
import { describe, expect, it } from "vitest";
import { runThreadLifecycleSweep } from "../../src/services/system/periodic-sweeps.js";
import {
  seedHostSession,
  seedProjectWithSource,
  seedThread,
} from "../helpers/seed.js";
import { withTestHarness } from "../helpers/test-app.js";

describe("confirmed thread deletion", () => {
  it("deletes the assigned child counted by the confirmation guard", async () => {
    await withTestHarness(async (harness) => {
      const { host } = seedHostSession(harness.deps);
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
      });
      const parent = seedThread(harness.deps, { projectId: project.id });
      const assigned = seedThread(harness.deps, {
        projectId: project.id,
        parentThreadId: parent.id,
      });
      const owned = seedThread(harness.deps, {
        projectId: project.id,
        lifecycleOwnerThreadId: parent.id,
      });
      const unrelated = seedThread(harness.deps, { projectId: project.id });
      const summaryResponse = await harness.app.request(
        `/api/v1/threads/${parent.id}/child-summary`,
      );
      expect(summaryResponse.status).toBe(200);
      expect(await summaryResponse.json()).toMatchObject({
        nonDeletedChildCount: 1,
      });
      const remove = (confirmed: boolean) =>
        harness.app.request(`/api/v1/threads/${parent.id}`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ childThreadsConfirmed: confirmed }),
        });
      expect((await remove(false)).status).toBe(409);
      expect(getThread(harness.db, parent.id)?.deletedAt).toBeNull();
      expect((await remove(true)).status).toBe(200);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await runThreadLifecycleSweep(harness.deps);
      }
      const parentResponse = await harness.app.request(
        `/api/v1/threads/${parent.id}`,
      );
      const assignedResponse = await harness.app.request(
        `/api/v1/threads/${assigned.id}`,
      );
      const ownedResponse = await harness.app.request(
        `/api/v1/threads/${owned.id}`,
      );
      const surviving = getThread(harness.db, assigned.id);
      console.log(JSON.stringify({
        parentStatus: parentResponse.status,
        assignedChildStatus: assignedResponse.status,
        ownedChildStatus: ownedResponse.status,
        assignedArchivedAt: surviving?.archivedAt,
        assignedDeletedAt: surviving?.deletedAt,
        assignedStillReferencesParent: surviving?.parentThreadId === parent.id,
        parentPhysicallyRemoved: getThread(harness.db, parent.id) === null,
      }));
      expect(parentResponse.status).toBe(404);
      expect(ownedResponse.status).toBe(404);
      expect(getThread(harness.db, unrelated.id)?.deletedAt).toBeNull();
      expect(assignedResponse.status).toBe(404);
    });
  });
});
