import { expect, it } from "vitest";
import { updateThreadRequestSchema } from "../src/api/threads.js";

it("accepts a standalone service-tier preference update", () => {
  const result = updateThreadRequestSchema.safeParse({ serviceTier: "default" });
  expect(result.success).toBe(true);
  if (result.success) expect(result.data).toEqual({ serviceTier: "default" });
});
