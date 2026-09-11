import { expect, it } from "vitest";
import { extractClaudeResultTokenUsage } from "./sdk-extraction.js";
import { threadEventTokenUsageBreakdownSchema } from "@bb/domain";

it("keeps distinguishable cache read and creation usage", () => {
  const result = (reads: number, writes: number) => extractClaudeResultTokenUsage({
    type: "result", subtype: "success", usage: {
      input_tokens: 11, output_tokens: 7,
      cache_read_input_tokens: reads, cache_creation_input_tokens: writes,
    },
  });
  const readHeavy = result(90, 10);
  const writeHeavy = result(10, 90);
  console.log(JSON.stringify({ readHeavy, writeHeavy }));
  expect(readHeavy).not.toEqual(writeHeavy);
});

it("retains cache creation information through the shared usage boundary", () => {
  const usage = { totalTokens: 118, inputTokens: 11, cachedInputTokens: 100,
    outputTokens: 7, reasoningOutputTokens: 0, cacheWriteInputTokens: 10 };
  const parsed = threadEventTokenUsageBreakdownSchema.parse(usage);
  console.log(JSON.stringify({ parsed }));
  expect(parsed).toHaveProperty("cacheWriteInputTokens", 10);
});
