import { expect, it } from "vitest";
import { toCodexServiceTier } from "./session-params.js";

it("retains an explicit default-tier reset in the serialized request", () => {
  expect(JSON.stringify({ serviceTier: toCodexServiceTier("fast") })).toBe(
    '{"serviceTier":"fast"}',
  );
  expect(JSON.stringify({ serviceTier: toCodexServiceTier("default") })).toBe(
    '{"serviceTier":null}',
  );
});
