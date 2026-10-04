import { describe, expect, it } from "vitest";
import { experimental_createDeltaAssembler as createDeltaAssembler } from "@get-bb/plugin-sdk/provider-bridge/testing";
import {
  createPiDeltaTranslator,
  createPiModelContextWindowResolverFrom,
} from "./delta-translation.js";

const imageContent = [
  {
    type: "image",
    mimeType: "image/png",
    data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ5kAAAAASUVORK5CYII=",
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
      expected: "toolCall",
    },
    {
      name: "image-bearing failure",
      content: imageContent,
      failed: true,
      expected: "toolCall",
    },
  ])("Pi: $name", ({ content, failed, expected }) => {
    const translator = createPiDeltaTranslator({
      resolveModelContextWindow: createPiModelContextWindowResolverFrom([]),
    });
    const assembler = createDeltaAssembler({
      providerId: "pi",
      entropyPrefix: "image-read",
      textDeltaFlushMs: 0,
    });
    const translate = (event: unknown) =>
      assembler.assemble({
        threadId: "image-read-thread",
        deltas: translator.translate(event, { cwd: "/workspace" }),
      });
    translate({ type: "agent_start" });
    const started = translate({
      type: "tool_execution_start",
      toolCallId: "native-read",
      toolName: "read",
      args: { path: "/workspace/diagram.png" },
    });
    const events = translate({
      type: "tool_execution_end",
      toolCallId: "native-read",
      toolName: "read",
      result: { content },
      isError: failed,
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
    console.log(JSON.stringify({ provider: "pi", item: completed.item }));
    expect(completed.item.id).toBe(opened.item.id);
    expect(completed.item.status).toBe(failed ? "failed" : "completed");
    expect(completed.item.type).toBe(expected);
    if (expected === "imageView") {
      expect(completed.item).toMatchObject({ path: "/workspace/diagram.png" });
      expect(completed.item.presentation).toMatchObject({
        label: { pending: "Viewing image", completed: "Viewed image" },
        icon: { glyph: "Eye" },
      });
    }
  });
});
