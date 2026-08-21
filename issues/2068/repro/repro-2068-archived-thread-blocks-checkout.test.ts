// Repro for get-bb/bb#2068: archived idle threads keep the workspace "live"
// for the branch-checkout guard in unmanagedAttachRefusal().
import { archiveThread, getThread, listEnvironments } from "@bb/db";
import { describe, expect, it } from "vitest";
import { createThreadFromRequest } from "../../src/services/threads/thread-create.js";
import { unmanagedAttachRefusal } from "../../src/services/threads/workspace-path-claims.js";
import { textInput } from "../helpers/prompt-input.js";
import {
  seedEnvironment,
  seedHostSession,
  seedProjectWithSource,
  seedThread,
} from "../helpers/seed.js";
import { withTestHarness } from "../helpers/test-app.js";

const HOST_DATA_DIR = "/home/agent/.bb";
const SHARED_PATH = "/tmp/repro-2068-workspace";

describe("#2068 archived idle thread and the branch-checkout guard", () => {
  it("unmanagedAttachRefusal: an archived idle thread must not count as a live workspace user", async () => {
    await withTestHarness(async (harness) => {
      const { host } = seedHostSession(harness.deps, { id: "host-2068-unit" });
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
        name: "Repro 2068",
        path: SHARED_PATH,
      });
      const environment = seedEnvironment(harness.deps, {
        hostId: host.id,
        projectId: project.id,
        path: SHARED_PATH,
      });
      const thread = seedThread(harness.deps, {
        projectId: project.id,
        environmentId: environment.id,
        status: "idle",
      });

      // Same write the archive route performs (thread-archive.ts ->
      // archiveThreadAndReleaseChildren -> archiveThread).
      archiveThread(harness.deps.db, harness.deps.hub, thread.id);
      const archived = getThread(harness.deps.db, thread.id);
      expect(archived?.archivedAt).not.toBeNull();
      expect(archived?.status).toBe("idle");

      // FAILS on fcada5a3b: returns { reason: "live-thread", ... }
      expect(
        unmanagedAttachRefusal(harness.deps.db, {
          checksOutBranch: true,
          dataDir: HOST_DATA_DIR,
          hostId: host.id,
          path: SHARED_PATH,
          projectId: project.id,
        }),
      ).toBeNull();
    });
  });

  it("createThreadFromRequest: 'New branch from main' in a project whose only thread is archived must not 409", async () => {
    await withTestHarness(async (harness) => {
      const { host } = seedHostSession(harness.deps, { id: "host-2068-route" });
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
        name: "Repro 2068 route",
        path: SHARED_PATH,
      });
      const environment = seedEnvironment(harness.deps, {
        hostId: host.id,
        projectId: project.id,
        path: SHARED_PATH,
      });
      const oldThread = seedThread(harness.deps, {
        projectId: project.id,
        environmentId: environment.id,
        status: "idle",
      });
      archiveThread(harness.deps.db, harness.deps.hub, oldThread.id);

      // FAILS on fcada5a3b with ApiError 409
      // "Cannot checkout branch while another thread is using this workspace"
      const thread = await createThreadFromRequest(harness.deps, {
        environment: {
          type: "host",
          hostId: host.id,
          workspace: {
            type: "unmanaged",
            path: SHARED_PATH,
            branch: { kind: "new", baseBranch: "main" },
          },
        },
        input: textInput("Reply only with ok."),
        origin: "app",
        projectId: project.id,
        providerId: "codex",
        startedOnBehalfOf: null,
      });
      expect(thread.projectId).toBe(project.id);
      expect(listEnvironments(harness.deps.db, project.id)).toHaveLength(1);
    });
  });

  it("control: an unarchived active thread at the path still refuses the checkout", async () => {
    await withTestHarness(async (harness) => {
      const { host } = seedHostSession(harness.deps, { id: "host-2068-ctrl" });
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
        name: "Repro 2068 control",
        path: SHARED_PATH,
      });
      const environment = seedEnvironment(harness.deps, {
        hostId: host.id,
        projectId: project.id,
        path: SHARED_PATH,
      });
      seedThread(harness.deps, {
        projectId: project.id,
        environmentId: environment.id,
        status: "active",
      });

      expect(
        unmanagedAttachRefusal(harness.deps.db, {
          checksOutBranch: true,
          dataDir: HOST_DATA_DIR,
          hostId: host.id,
          path: SHARED_PATH,
          projectId: project.id,
        }),
      ).toMatchObject({ reason: "live-thread" });
    });
  });
});
