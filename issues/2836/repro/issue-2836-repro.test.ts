import { describe, expect, it, vi } from "vitest";
import * as domain from "@bb/domain";
import {
  runCommand,
  setupCommandOutputTestEnvironment,
  stubServerApi,
} from "../helpers/command-output-harness.js";
import type { CommandRegistrar } from "../helpers/command-output-harness.js";
import * as fixtures from "../helpers/command-output-fixtures.js";
import { registerThreadCommands } from "../../commands/thread/index.js";

describe("thread spawn parent context", () => {
  setupCommandOutputTestEnvironment();

  const register: CommandRegistrar = (program) =>
    registerThreadCommands(program, () => "http://server");

  it("uses the current thread as the default parent", async () => {
    vi.stubEnv("BB_THREAD_ID", "thread-context-parent");
    const thread: domain.Thread = fixtures.makeThread({
      id: "thread-child",
      projectId: "proj-1",
      providerId: "codex",
      parentThreadId: "thread-context-parent",
    });
    const post = vi.fn(async () => thread);
    stubServerApi({ "v1.threads.$post": post });

    await runCommand(
      ["thread", "spawn", "--project", "proj-1", "--prompt", "review"],
      register,
    );

    expect(post).toHaveBeenCalledWith({
      json: expect.objectContaining({
        parentThreadId: "thread-context-parent",
      }),
    });
  });
});
