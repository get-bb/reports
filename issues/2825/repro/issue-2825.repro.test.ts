import type { ModelInfo } from "@anthropic-ai/claude-agent-sdk";
import { describe, expect, it } from "vitest";
import { buildClaudeCodeModels } from "./model-list.js";
import { resolveClaudeModelContextWindowHint } from "./sdk-extraction.js";

const DISCOVERED_FABLE_MODEL: ModelInfo = {
  value: "claude-fable-5-1[1m]",
  resolvedModel: "claude-fable-5-1",
  displayName: "Fable",
  description: "Fable",
  supportedEffortLevels: ["low", "medium", "high", "xhigh", "max"],
};

describe("Claude Code Fable 5.1 metadata", () => {
  it("uses curated Fable 5.1 metadata for a discovered model", () => {
    const result = buildClaudeCodeModels([DISCOVERED_FABLE_MODEL]);

    expect(
      result.models.filter((model) => model.model.includes("fable")),
    ).toEqual([
      expect.objectContaining({
        model: "claude-fable-5-1",
        displayName: "Fable 5.1",
      }),
    ]);
  });

  it.each(["claude-fable-5-1", "claude-mythos-5-1"])(
    "reports the native context window for %s",
    (model) => {
      expect(resolveClaudeModelContextWindowHint(model)).toBe(1_000_000);
    },
  );

  it("uses current model names in moving alias descriptions", () => {
    const result = buildClaudeCodeModels([
      { ...DISCOVERED_FABLE_MODEL, value: "best" },
      { ...DISCOVERED_FABLE_MODEL, value: "fable" },
    ]);

    expect(
      result.selectedOnlyModels
        .filter((model) => model.model === "best" || model.model === "fable")
        .map((model) => model.description),
    ).toEqual([
      expect.stringContaining("Fable 5.1"),
      expect.stringContaining("Fable 5.1"),
    ]);
  });
});

