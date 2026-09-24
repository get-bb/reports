import { expect, it } from "vitest";
import { pendingInteractionPayloadSchema } from "../../packages/domain/src/pending-interactions.js";
import { createExtensionUiCoordinator } from "./src/bridge/extension-ui.js";
import { piExtensionUiRequestSchema, type InteractionUiRequest, type PiExtensionUiResponseFields } from "./src/extension-ui-contract.js";

function exercise(length: number, mode: "answer" | "throw" | "cancel" = "answer") {
  const sent: InteractionUiRequest[] = [];
  const replies: PiExtensionUiResponseFields[] = [];
  const request = { id: "sample", method: "select", title: "T".repeat(length), options: ["Proceed", "Stop"] };
  const coordinator = createExtensionUiCoordinator({ sendInteractionRequest(message) {
    if (mode === "throw") throw new Error("Transport unavailable");
    sent.push(message);
  } });
  coordinator.handle({ scope: {}, request, threadId: "thr_test", providerThreadId: "pi_test", respond(_id, fields) { replies.push(fields); } });
  const forwarded = sent[0];
  const coreAccepted = forwarded ? pendingInteractionPayloadSchema.safeParse(forwarded.params.payload).success : null;
  if (forwarded) coordinator.handleRuntimeResponse(coreAccepted
    ? { id: forwarded.id, result: { kind: "request_answer", value: mode === "cancel" ? null : "Proceed" } }
    : { id: forwarded.id, error: { message: "Unsupported provider request" } });
  return { length, mode, providerAccepted: piExtensionUiRequestSchema.safeParse(request).success, forwarded: sent.length, coreAccepted, replies };
}

it("records title boundaries and failure paths", () => {
  const rows = [160, 161, 200, 201, 244].map(length => exercise(length));
  rows.push(exercise(160, "throw"), exercise(160, "cancel"));
  process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
  expect(rows[0].replies).toEqual([{ value: "Proceed" }]);
  expect(rows.slice(1).map(row => row.replies)).toEqual(Array.from({length: 6}, () => [{ cancelled: true }]));
  expect(rows.map(row => row.coreAccepted)).toEqual([true, false, false, null, null, null, true]);
});

it.each([161, 200, 201])("regression: validation failure at %i must not claim user cancellation", length => {
  expect(exercise(length).replies).not.toContainEqual({ cancelled: true });
});
it("regression: a transport exception must not claim user cancellation", () => {
  expect(exercise(160, "throw").replies).not.toContainEqual({ cancelled: true });
});
