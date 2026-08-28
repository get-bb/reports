import { threadScope, type ProviderRateLimitState } from "@bb/domain";
import { describe, expect, it } from "vitest";
import { readJson } from "../helpers/json.js";
import { seedEvent, seedThreadFixture } from "../helpers/seed.js";
import { withTestHarness } from "../helpers/test-app.js";

const rateLimits = {
  providerId: "claude-code",
  status: "blocked",
  kind: "subscription-window",
  windows: [
    {
      providerKey: "five_hour",
      label: "Five-hour limit",
      status: "blocked",
      resetsAtMs: 2_000_000_000_000,
    },
  ],
  reachedReason: "five_hour",
  overageStatus: "rejected",
  overageReason: "The current limit was reached.",
} satisfies ProviderRateLimitState;

describe("public thread rate-limit state", () => {
  it("returns current thread activity and the latest rate-limit state", async () => {
    await withTestHarness(async (harness) => {
      const { thread } = seedThreadFixture(harness, {
        thread: { providerId: "claude-code", status: "idle" },
      });
      seedEvent(harness.deps, {
        threadId: thread.id,
        providerThreadId: "provider-thread-rate-limit",
        sequence: 1,
        type: "provider/rateLimits/updated",
        scope: threadScope(),
        data: { rateLimits },
      });

      const showResponse = await harness.app.request(
        `/api/v1/threads/${thread.id}`,
      );
      const listResponse = await harness.app.request("/api/v1/threads");
      expect(showResponse.status).toBe(200);
      expect(listResponse.status).toBe(200);

      const shown = await readJson(showResponse);
      const listed = await readJson(listResponse);
      expect.soft(shown).toHaveProperty("activity", {
        activeBackgroundAgentCount: 0,
        activeBackgroundCommandCount: 0,
        activeGoalCount: 0,
        activePlanModeCount: 0,
        activeWorkflowCount: 0,
      });
      expect.soft(shown).toHaveProperty("rateLimits", rateLimits);
      expect.soft(listed).toEqual([
        expect.objectContaining({ rateLimits }),
      ]);
    });
  });
});
