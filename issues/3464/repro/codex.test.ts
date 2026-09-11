import { expect, it } from "vitest";
import { createCodexEventTranslationState, translateCodexEventToDeltas } from "./delta-translation.js";

it("preserves nonzero cache creation in both usage intervals", () => {
  const usage = { totalTokens: 120, inputTokens: 100, cachedInputTokens: 30,
    cacheWriteInputTokens: 20, outputTokens: 20, reasoningOutputTokens: 0 };
  const deltas = translateCodexEventToDeltas({ jsonrpc: "2.0", method: "thread/tokenUsage/updated",
    params: { threadId: "repro-thread", turnId: "repro-turn", tokenUsage: {
      total: usage, last: { ...usage, cacheWriteInputTokens: 8 }, modelContextWindow: 1000,
    } },
  }, createCodexEventTranslationState());
  const result = deltas.find(delta => delta.kind === "usage");
  console.log(JSON.stringify({ result }));
  expect(result).toMatchObject({ total: { cacheWriteInputTokens: 20 }, last: { cacheWriteInputTokens: 8 } });
});
