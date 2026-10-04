import { describe, expect, it } from "vitest";
import { createClaudeDeltaHarness } from "./delta-test-harness.js";

const imageContent = [
  {
    type: "image",
    source: {
      type: "base64",
      media_type: "image/png",
      data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ5kAAAAASUVORK5CYII=",
    },
  },
];

describe("native image read completion", () => {
  it.each([
    {
      name: "image success",
      content: imageContent,
      failed: false,
      expected: "imageView",
    },
    {
      name: "text at image path",
      content: [{ type: "text", text: "plain text" }],
      failed: false,
      expected: "fileRead",
    },
    {
      name: "image-bearing failure",
      content: imageContent,
      failed: true,
      expected: "fileRead",
    },
  ])("Claude: $name", ({ content, failed, expected }) => {
    const harness = createClaudeDeltaHarness();
    const started = harness.translate({
      type: "assistant",
      session_id: "image-read-session",
      message: {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "native-read",
            name: "Read",
            input: { file_path: "/workspace/diagram.png" },
          },
        ],
      },
    });
    const events = harness.translate({
      type: "user",
      session_id: "image-read-session",
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "native-read",
            is_error: failed,
            content,
          },
        ],
      },
    });
    const opened = started.find((event) => event.type === "item/started");
    const completed = events.find((event) => event.type === "item/completed");
    expect(opened?.type).toBe("item/started");
    expect(completed?.type).toBe("item/completed");
    if (
      opened?.type !== "item/started" ||
      completed?.type !== "item/completed"
    ) {
      throw new Error("Expected one native read lifecycle");
    }
    console.log(
      JSON.stringify({ provider: "claude-code", item: completed.item }),
    );
    expect(completed.item.id).toBe(opened.item.id);
    expect(completed.item.status).toBe(failed ? "failed" : "completed");
    expect(completed.item).toMatchObject({
      type: expected,
      path: "/workspace/diagram.png",
    });
    if (expected === "imageView") {
      expect(completed.item.presentation).toMatchObject({
        label: { pending: "Viewing image", completed: "Viewed image" },
        icon: { glyph: "Eye" },
      });
    }
  });
});
