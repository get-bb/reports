import { describe, expect, it } from "vitest";
import { buildClaudeCodeModels } from "./model-list.js";

describe("Claude Code model reasoning metadata", () => {
  it("keeps the full reasoning ladder on every curated model", () => {
    const result = buildClaudeCodeModels([]);

    expect(
      result.models.map((model) => ({
        model: model.model,
        reasoning: model.supportedReasoningEfforts.map(
          (effort) => effort.reasoningEffort,
        ),
      })),
    ).toEqual([
      {
        model: "claude-fable-5-1",
        reasoning: ["low", "medium", "high", "xhigh", "ultracode", "max"],
      },
      {
        model: "claude-opus-5[1m]",
        reasoning: ["low", "medium", "high", "xhigh", "ultracode", "max"],
      },
      {
        model: "claude-opus-4-8[1m]",
        reasoning: ["low", "medium", "high", "xhigh", "ultracode", "max"],
      },
      {
        model: "claude-opus-4-7[1m]",
        reasoning: ["low", "medium", "high", "xhigh", "ultracode", "max"],
      },
      {
        model: "claude-sonnet-5",
        reasoning: ["low", "medium", "high", "xhigh", "ultracode", "max"],
      },
    ]);
  });
});
