// Repro for get-bb/bb#1711: a live parent thread in another project is
// rejected by assertValidParentThread with reason "wrong_project".
import {
  createConnection,
  createProject,
  createThread,
  migrate,
  noopNotifier,
  upsertHost,
} from "@bb/db";
import { describe, expect, it } from "vitest";
import { ApiError } from "../../src/errors.js";
import { assertValidParentThread } from "../../src/services/threads/thread-parent.js";

function setup() {
  const db = createConnection(":memory:");
  migrate(db);
  const host = upsertHost(db, noopNotifier, {
    name: "test-host",
    type: "persistent",
  });
  const { project: projectA } = createProject(db, noopNotifier, {
    name: "project-a",
    source: { hostId: host.id, path: "/tmp/bb1711-a", type: "local_path" },
  });
  const { project: projectB } = createProject(db, noopNotifier, {
    name: "project-b",
    source: { hostId: host.id, path: "/tmp/bb1711-b", type: "local_path" },
  });
  return { db, projectA, projectB };
}

describe("issue #1711: cross-project parent thread", () => {
  it("accepts a live, non-archived parent thread that lives in another project", () => {
    const { db, projectA, projectB } = setup();
    // Parent lives in project A and is perfectly healthy.
    const parentThread = createThread(db, noopNotifier, {
      projectId: projectA.id,
      providerId: "codex",
    });
    expect(parentThread.archivedAt).toBeNull();
    expect(parentThread.deletedAt).toBeNull();

    // A child is being created in project B with --parent-thread <A's thread>.
    let error: ApiError | null = null;
    try {
      assertValidParentThread(
        { db },
        { parentThreadId: parentThread.id, projectId: projectB.id },
      );
    } catch (caught) {
      if (!(caught instanceof ApiError)) throw caught;
      error = caught;
    }

    // On main this fails: the server answers
    //   400 parent_thread_invalid "Parent thread is invalid" { reason: "wrong_project" }
    expect(error).toBeNull();
  });
});
