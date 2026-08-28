import { describe, expect, it } from "vitest";
import { readJson } from "../helpers/json.js";
import { withTestHarness } from "../helpers/test-app.js";

describe("public thread search limit", () => {
  it("rejects a limit above the server maximum", async () => {
    await withTestHarness(async (harness) => {
      const response = await harness.app.request(
        "/api/v1/threads/search?query=valid&limitPerGroup=51",
      );

      expect(response.status).toBe(400);
      expect(await readJson(response)).toMatchObject({
        code: "invalid_request",
        message: "limitPerGroup must be at most 50",
      });
    });
  });
});
