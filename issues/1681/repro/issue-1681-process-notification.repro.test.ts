/**
 * Repro for get-bb/bb#1681: Pi process notifications (custom messages sent by
 * a Pi extension with `triggerTurn: true`, e.g. @aliou/pi-processes
 * `ad-process:notification`) are not projected by bb.
 *
 * Feeds the exact SDK event sequence Pi's AgentSession emits for
 * `sendCustomMessage(msg, { triggerTurn: true })` while idle:
 *   agent_start -> message_start(custom) -> message_end(custom)
 *   -> (assistant streaming) -> agent_end(messages incl. custom w/ string content)
 * wrapped in the bridge's `sdk/message` envelope.
 */
import { describe, expect, it } from "vitest";
import { turnScope } from "@bb/domain";
import { createPiEventTranslator } from "./event-translation.js";

const CONTENT =
  '<process_event type="lifecycle" kind="success" process_id="proc_551c" name="sleep">Process completed successfully</process_event>';

const customMessage = {
  role: "custom",
  customType: "ad-process:notification",
  content: CONTENT, // string, as CustomMessage.content allows
  display: true,
  details: { attention: "turn", kind: "success", processId: "proc_551c" },
  timestamp: 1_786_919_243_630,
};

function sdk(message: unknown) {
  return {
    jsonrpc: "2.0" as const,
    method: "sdk/message",
    params: { threadId: "pi-thread-1", message },
  };
}

describe("issue #1681 — Pi process notification wake", () => {
  it("translates an idle attention:turn notification into one visible turn with input and completion", () => {
    const translator = createPiEventTranslator({ providerId: "pi" });
    const context = { threadId: "pi-thread-1" };
    const all = [
      sdk({ type: "agent_start" }),
      sdk({ type: "message_start", message: customMessage }),
      sdk({ type: "message_end", message: customMessage }),
      sdk({
        type: "agent_end",
        willRetry: false,
        messages: [
          customMessage,
          {
            role: "assistant",
            content: [{ type: "text", text: "The sleep process finished." }],
            stopReason: "stop",
            api: "openai-responses",
            provider: "openai-codex",
            model: "gpt-5.6-sol",
            usage: {
              input: 10,
              output: 5,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 15,
              cost: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                total: 0,
              },
            },
            timestamp: 1_786_919_246_950,
          },
        ],
      }),
    ].flatMap((event) => translator.translatePiEvent(event, context));

    const types = all.map((event) =>
      event.type === "provider/unhandled"
        ? `provider/unhandled(${event.rawType})`
        : event.type,
    );
    console.log("translated:", JSON.stringify(types, null, 2));

    // (1) the custom message_start/message_end envelopes must not surface as unhandled
    expect(all.filter((event) => event.type === "provider/unhandled")).toEqual(
      [],
    );
    // (2) exactly one turn starts
    expect(all.filter((event) => event.type === "turn/started")).toHaveLength(
      1,
    );
    // (3) the process event is visible as turn input
    expect(all).toContainEqual(
      expect.objectContaining({
        type: "item/completed",
        scope: turnScope("turn-1"),
        item: expect.objectContaining({ type: "userMessage" }),
      }),
    );
    // (4) the turn completes (agent_end with a string-content custom entry must be accepted)
    expect(all).toContainEqual(
      expect.objectContaining({
        type: "turn/completed",
        scope: turnScope("turn-1"),
        status: "completed",
      }),
    );
  });
});
