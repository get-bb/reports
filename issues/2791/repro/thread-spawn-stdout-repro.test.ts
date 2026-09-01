import { describe, expect, it, vi } from "vitest";
import {
  collectLogLines,
  runCommand,
  setupCommandOutputTestEnvironment,
  stubServerApi,
} from "../helpers/command-output-harness.js";
import type { CommandRegistrar } from "../helpers/command-output-harness.js";
import * as fixtures from "../helpers/command-output-fixtures.js";
import { registerThreadCommands } from "../../commands/thread/index.js";

describe("bb thread spawn standard output reproduction", () => {
  setupCommandOutputTestEnvironment();

  const register: CommandRegistrar = (program) =>
    registerThreadCommands(program, () => "http://server");

  it("prints the new thread ID for a multi-line prompt without JSON output", async () => {
    const thread = fixtures.makeThread({
      id: "thread-multiline-prompt",
      projectId: "proj-1",
      providerId: "claude-code",
      status: "starting",
    });
    stubServerApi({ "v1.threads.$post": vi.fn(async () => thread) });

    await runCommand(
      [
        "thread",
        "spawn",
        "--project",
        "proj-1",
        "--provider",
        "claude-code",
        "--prompt",
        ["first line", "second line"].join("\n"),
      ],
      register,
    );

    expect(collectLogLines(vi.mocked(console.log))).toContain(
      "Thread spawned: thread-multiline-prompt",
    );
    expect(collectLogLines(vi.mocked(console.log))).toContain(
      "  ID:       thread-multiline-prompt",
    );
  });
});
