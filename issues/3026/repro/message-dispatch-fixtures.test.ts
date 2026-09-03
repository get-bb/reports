import { describe, expect, it } from "vitest";
import { makeMessageDispatchHookContext } from "../index.js";

describe("makeMessageDispatchHookContext", () => {
  it("aligns relationship IDs with overridden records", () => {
    const result = makeMessageDispatchHookContext({
      project: { id: "project-replacement" },
      environment: { id: "environment-replacement" },
      host: { id: "host-replacement" },
    });

    expect({
      threadProjectId: result.thread.projectId,
      threadEnvironmentId: result.thread.environmentId,
      environmentProjectId: result.environment?.projectId,
      environmentHostId: result.environment?.hostId,
    }).toEqual({
      threadProjectId: result.project.id,
      threadEnvironmentId: result.environment?.id,
      environmentProjectId: result.project.id,
      environmentHostId: result.host?.id,
    });
  });
});
