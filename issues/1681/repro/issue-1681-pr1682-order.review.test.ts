/**
 * Review probe for PR #1682: Pi emits `agent_start` BEFORE the custom
 * `message_start` when an extension calls sendMessage({triggerTurn:true}) on
 * an idle session (observed live: turn/started seq 12, message_start seq 13).
 * The PR's tests feed the notification first, so this probes the real order.
 */
import { describe, expect, it } from "vitest";
import { createPiEventTranslator } from "./event-translation.js";

const customMessage = {
  role: "custom",
  customType: "ad-process:notification",
  content: '<process_event type="lifecycle" kind="success" />',
  display: true,
  details: { attention: "turn", kind: "success", processId: "proc_1" },
  timestamp: 1,
};

function sdk(message: unknown) {
  return {
    jsonrpc: "2.0" as const,
    method: "sdk/message",
    params: { threadId: "pi-thread-1", message },
  };
}

const emptyAssistantEnd = {
  type: "agent_end",
  willRetry: false,
  messages: [
    customMessage,
    { role: "assistant", content: [], stopReason: "stop" },
  ],
};

describe("PR #1682 review: real SDK ordering (agent_start before message_start)", () => {
  it("emits the 'no text response' warning when the notification arrives after agent_start", () => {
    const translator = createPiEventTranslator({ providerId: "pi" });
    const context = { threadId: "pi-thread-1" };
    const events = [
      sdk({ type: "agent_start" }),
      sdk({ type: "message_start", message: customMessage }),
      sdk({ type: "message_end", message: customMessage }),
      sdk(emptyAssistantEnd),
    ].flatMap((event) => translator.translatePiEvent(event, context));
    const types = events.map((e) => e.type);
    // Sanity: still one turn, one userMessage item, one completion.
    expect(types.filter((t) => t === "turn/started")).toHaveLength(1);
    expect(types).toContain("turn/completed");
    // The PR advertises a warning for a process-triggered turn without text.
    // With the real ordering `processNotificationTurnId` is never set, so the
    // warning does not fire.
    expect(types).toContain("provider/warning");
  });
});
