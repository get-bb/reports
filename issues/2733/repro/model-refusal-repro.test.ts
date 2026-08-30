import { expect, it } from "vitest";
import { createClaudeDeltaHarness } from "./delta-test-harness.js";

it("classifies a refusal without a fallback as a policy error", () => {
  const harness = createClaudeDeltaHarness();
  const events = harness.translate({
    type: "system",
    subtype: "model_refusal_no_fallback",
    original_model: "claude-example",
    request_id: "req-1",
    api_refusal_category: "cyber",
    api_refusal_explanation: "The request matched a policy safeguard.",
    refused_user_message_uuid: "user-1",
    content: "The model refused this request.",
    uuid: "system-1",
    session_id: "session-1",
  });

  expect(events).toContainEqual(
    expect.objectContaining({
      type: "provider/error",
      detail: "The model refused this request.",
      errorInfo: {
        category: "policy",
        providerCode: "cyber",
        httpStatusCode: null,
      },
    }),
  );
});
