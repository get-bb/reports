import { describe, expect, it } from "vitest";
import { createClaudeDeltaHarness } from "./delta-test-harness.js";

function startTurn(
  harness: ReturnType<typeof createClaudeDeltaHarness>,
  threadId: string,
) {
  harness.translate(
    {
      jsonrpc: "2.0",
      method: "sdk/message",
      params: {
        threadId,
        message: {
          type: "assistant",
          message: { id: threadId, content: [] },
        },
      },
    },
    { threadId },
  );
}

function resultEvent(threadId: string, failed: boolean) {
  return {
    jsonrpc: "2.0",
    method: "sdk/message",
    params: {
      threadId,
      message: {
        type: "result",
        subtype: failed ? "error_during_execution" : "success",
        is_error: failed,
        ...(failed ? { api_error_status: 402 } : {}),
        result: failed ? "Synthetic Claude billing rejection" : "ok",
        usage: {},
        modelUsage: {},
      },
    },
  };
}

describe("issue 7453 provider-boundary investigation", () => {
  it("accepts a successful Claude result without a billing error", () => {
    const harness = createClaudeDeltaHarness();
    startTurn(harness, "claude-success");
    const events = harness.translate(resultEvent("claude-success", false), {
      threadId: "claude-success",
    });
    expect(events.filter((event) => event.type === "provider/error")).toEqual([]);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "turn/completed", status: "completed" }),
    );
  });

  it("surfaces the Claude upstream billing rejection verbatim", () => {
    const harness = createClaudeDeltaHarness();
    startTurn(harness, "claude-billing");
    const events = harness.translate(resultEvent("claude-billing", true), {
      threadId: "claude-billing",
    });
    expect(events.filter((event) => event.type === "provider/error")).toEqual([
      expect.objectContaining({
        detail: "Synthetic Claude billing rejection",
        errorInfo: {
          category: "billing",
          providerCode: "error_during_execution",
          httpStatusCode: 402,
        },
      }),
    ]);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "turn/completed", status: "failed" }),
    );
  });

  it("does not carry a billing failure into another Claude thread", () => {
    const harness = createClaudeDeltaHarness();
    startTurn(harness, "claude-billing");
    harness.translate(resultEvent("claude-billing", true), {
      threadId: "claude-billing",
    });
    startTurn(harness, "claude-other");
    const events = harness.translate(resultEvent("claude-other", false), {
      threadId: "claude-other",
    });
    expect(events.filter((event) => event.type === "provider/error")).toEqual([]);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "turn/completed", status: "completed" }),
    );
  });
});
