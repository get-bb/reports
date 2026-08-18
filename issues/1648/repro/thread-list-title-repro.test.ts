// Repro for get-bb/bb#1648: `bb thread list` prints ID/Project/Status but no
// thread title, even though the server returns `title` / `titleFallback`.
import { describe, expect, it, vi } from "vitest";
import {
  setupCommandOutputTestEnvironment,
  collectLogPayloads,
  runCommand,
  stubServerApi,
} from "../helpers/command-output-harness.js";
import type { CommandRegistrar } from "../helpers/command-output-harness.js";
import * as fixtures from "../helpers/command-output-fixtures.js";
import { registerThreadCommands } from "../../commands/thread/index.js";

describe("issue #1648: bb thread list shows thread titles", () => {
  setupCommandOutputTestEnvironment();

  const register: CommandRegistrar = (program) =>
    registerThreadCommands(program, () => "http://server");

  it("prints the thread title (or fallback) in the human-readable table", async () => {
    const list = vi.fn(async () => [
      fixtures.makeThread({
        id: "thr_a9niqhjj9c",
        projectId: "proj_bsst4jxfwv",
        providerId: "codex",
        status: "idle",
        title: "Investigate flaky login test",
        titleFallback: "Reply only with ok.",
        createdAt: 1,
        updatedAt: 1,
      }),
      fixtures.makeThread({
        id: "thr_uwfzqywzsz",
        projectId: "proj_bsst4jxfwv",
        providerId: "codex",
        status: "idle",
        title: null,
        titleFallback: "Reply only with ok. This is the second QA thread.",
        createdAt: 1,
        updatedAt: 1,
      }),
    ]);
    stubServerApi({ "v1.threads.$get": list });

    await runCommand(["thread", "list"], register);

    const output = collectLogPayloads(vi.mocked(console.log)).join("\n");
    // The header should advertise a Title column ...
    expect(output).toMatch(/^ID\s+.*Title/m);
    // ... and each row should carry the user-visible title.
    expect(output).toContain("Investigate flaky login test");
    // Threads with no explicit title still have a server-provided fallback.
    expect(output).toContain(
      "Reply only with ok. This is the second QA thread.",
    );
  });
});
