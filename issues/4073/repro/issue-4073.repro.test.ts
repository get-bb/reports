import { describe, expect, it } from "vitest";
import type { SDKLocalCommandOutputMessage } from "@anthropic-ai/claude-agent-sdk";
import { buildClaudeCodeModels } from "./model-list.js";
import { createClaudeDeltaTranslator } from "./delta-translation.js";
import { loadFixture } from "./delta-test-harness.js";

const discoveredModel = "claude-future-6";

describe("issue 4073 data-path reproduction", () => {
  it("offers an uncurated model when discovery supplies it", () => {
    const catalog = buildClaudeCodeModels([{
      value: "future",
      resolvedModel: discoveredModel,
      displayName: "Future 6",
      description: "Newly discovered model",
    }]);
    expect(catalog.models.some((model) => model.model === discoveredModel)).toBe(true);
  });

  it("does not invent an undiscovered model in the curated fallback", () => {
    expect(buildClaudeCodeModels([]).models.some((model) => model.model === discoveredModel)).toBe(false);
  });

  it("drops local-command output before it can update the selection", () => {
    const translator = createClaudeDeltaTranslator({ sandboxEnabled: false });
    const message = {
      type: "system",
      subtype: "local_command_output",
      content: "Model selection changed within the provider session",
      uuid: "00000000-0000-4000-8000-000000000001",
      session_id: "repro-session",
    } satisfies SDKLocalCommandOutputMessage;
    expect(translator.translate({
      jsonrpc: "2.0",
      method: "sdk/message",
      params: { threadId: "repro-thread", message },
    }, { threadId: "repro-thread" })).toEqual([]);
  });

  it("preserves an authoritative initialization model in outgoing deltas", () => {
    const translator = createClaudeDeltaTranslator({ sandboxEnabled: false });
    const deltas = translator.translate({
      jsonrpc: "2.0",
      method: "sdk/message",
      params: {
        threadId: "repro-thread",
        message: { ...loadFixture("system-init.json"), model: discoveredModel },
      },
    }, { threadId: "repro-thread" });
    expect(JSON.stringify(deltas)).toContain(discoveredModel);
  });
});
