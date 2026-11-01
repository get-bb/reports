import { describe, expect, it } from "vitest";
import { createClaudeDeltaHarness } from "./delta-test-harness.js";

describe("Claude command metadata", () => {
  it.each([
    {
      description: "Inspect workspace contents",
      title: "Inspect workspace contents",
    },
    { description: undefined, title: "ls -a" },
    { description: "  ", title: "ls -a" },
    { description: 42, title: "ls -a" },
  ])(
    "preserves the command title for description $description",
    ({ description, title }) => {
      const harness = createClaudeDeltaHarness();
      const started = harness.translate({
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "command-1",
              name: "Bash",
              input: { command: "ls -a", description },
            },
          ],
        },
        session_id: "metadata-test",
      });
      const completed = harness.translate({
        type: "user",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "command-1",
              content: "entries",
              is_error: false,
            },
          ],
        },
        session_id: "metadata-test",
      });
      for (const [events, type] of [
        [started, "item/started"],
        [completed, "item/completed"],
      ] as const) {
        expect(events).toContainEqual(
          expect.objectContaining({
            type,
            item: expect.objectContaining({
              type: "commandExecution",
              command: "ls -a",
              presentation: expect.objectContaining({ title }),
            }),
          }),
        );
      }
    },
  );

  it.each([
    { content: "Exit code 2\nsyntax error", isError: true, exitCode: 2 },
    {
      content: [{ type: "text", text: "Exit code 23\nfailed" }],
      isError: true,
      exitCode: 23,
    },
    {
      content: "Error: Exit code 126\r\nnot executable",
      isError: true,
      exitCode: 126,
    },
    {
      content: "Exit code 127\nnot found",
      isError: true,
      exitCode: 127,
      toolUseResult: { stdout: "", stderr: "not found" },
    },
    { content: "failed", isError: true, exitCode: 1 },
    {
      content: "Exit code 999999999999999999999\nfailed",
      isError: true,
      exitCode: 1,
    },
    { content: "Exit code 2.5\nfailed", isError: true, exitCode: 1 },
    { content: "log line\nExit code 23", isError: true, exitCode: 1 },
    { content: "Exit code 23\nprinted text", isError: false, exitCode: 0 },
    { content: "done", isError: false, exitCode: 0 },
  ])(
    "preserves exit code $exitCode for $content",
    ({ content, isError, exitCode, ...metadata }) => {
      const harness = createClaudeDeltaHarness();
      harness.translate({
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "command-1",
              name: "Bash",
              input: { command: "ls -a" },
            },
          ],
        },
        session_id: "metadata-test",
      });
      const events = harness.translate({
        type: "user",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "command-1",
              content,
              is_error: isError,
              tool_use_result: metadata.toolUseResult,
            },
          ],
        },
        session_id: "metadata-test",
      });
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "item/completed",
          item: expect.objectContaining({
            type: "commandExecution",
            exitCode,
            status: isError ? "failed" : "completed",
          }),
        }),
      );
    },
  );
});
