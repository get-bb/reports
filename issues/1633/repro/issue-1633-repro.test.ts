// Repro for get-bb/bb#1633: Pi agent_end that carries a custom message with
// STRING content (as pi-processes sends via pi.sendMessage) is rejected by the
// bb schema, so no turn/completed is emitted and the thread stays "working".
import { describe, expect, it } from "vitest";
import { turnScope } from "@bb/domain";
import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import { createPiEventTranslator } from "./event-translation.js";

type AgentEndMessages = Extract<AgentSessionEvent, { type: "agent_end" }>["messages"];

const assistant = (text: string): AgentEndMessages[number] => ({
  role: "assistant",
  content: [{ type: "text", text }],
  api: "anthropic-messages",
  provider: "anthropic",
  model: "claude-haiku-4-5",
  usage: {
    input: 10,
    output: 5,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 15,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
  stopReason: "stop",
  timestamp: 1777995781000,
});

function run(messages: AgentEndMessages) {
  const translator = createPiEventTranslator({ providerId: "pi" });
  const context = { threadId: "pi-thread-1" };
  const send = (message: AgentSessionEvent) =>
    translator.translatePiEvent(
      {
        jsonrpc: "2.0",
        method: "sdk/message",
        params: { threadId: context.threadId, message },
      },
      context,
    );
  send({ type: "agent_start" });
  return send({ type: "agent_end", messages, willRetry: false });
}

describe("#1633 Pi agent_end with string-content custom message", () => {
  it("control: array-content custom message completes the turn", () => {
    const events = run([
      {
        role: "custom",
        customType: "pi-processes",
        content: [{ type: "text", text: "Process completed successfully" }],
        display: true,
        timestamp: 1777995780000,
      },
      assistant("The process finished."),
    ]);
    expect(events.map((e) => e.type)).toContain("turn/completed");
  });

  it("BUG: string-content custom message (pi-processes shape) must still complete the turn", () => {
    const events = run([
      {
        role: "custom",
        customType: "pi-processes",
        content: "Process completed successfully",
        display: true,
        timestamp: 1777995780000,
      },
      assistant("The process finished."),
    ]);
    // Print what we actually got, so the log shows provider/unhandled on main.
    console.log("EVENT TYPES:", JSON.stringify(events.map((e) => e.type)));
    expect(events.some((e) => e.type === "provider/unhandled")).toBe(false);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "turn/completed",
        scope: turnScope("turn-1"),
        status: "completed",
      }),
    );
  });

  it("BUG: string-content USER message (pi.sendUserMessage) is also rejected", () => {
    const events = run([
      { role: "user", content: "hello from an extension", timestamp: 1 },
      assistant("ok"),
    ]);
    expect(events.some((e) => e.type === "provider/unhandled")).toBe(false);
    expect(events.map((e) => e.type)).toContain("turn/completed");
  });
});
