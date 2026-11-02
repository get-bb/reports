import { expect, it } from "vitest";
import {
  experimental_createDeltaAssembler as createDeltaAssembler,
  type ThreadEvent,
} from "@get-bb/plugin-sdk/provider-bridge/testing";
import { createPiDeltaTranslator } from "./delta-translation.js";

it.each(["stop", "missing", "aborted", "error"])(
  "preserves the prior assistant text across a %s message boundary",
  (boundary) => {
    const translator = createPiDeltaTranslator({
      resolveModelContextWindow: () => undefined,
    });
    const assembler = createDeltaAssembler({
      providerId: "pi",
      entropyPrefix: "repro-6808",
      textDeltaFlushMs: 0,
    });
    const events: ThreadEvent[] = [];
    const deliver = (event: unknown) => {
      events.push(
        ...assembler.assemble({
          threadId: "repro-thread",
          deltas: translator.translate(event, { threadId: "repro-thread" }),
        }),
      );
    };
    const first = {
      role: "assistant",
      content: [{ type: "text", text: "Original analysis." }],
      stopReason: boundary,
    };
    const second = {
      role: "assistant",
      content: [{ type: "text", text: "New response." }],
      stopReason: "stop",
    };

    deliver({ type: "agent_start" });
    deliver({
      type: "message_start",
      message: { role: "assistant", content: [] },
    });
    deliver({
      type: "message_update",
      assistantMessageEvent: {
        type: "text_delta",
        contentIndex: 0,
        delta: "Original analysis.",
      },
    });
    deliver({ type: "queue_update", steering: ["New input."], followUp: [] });
    if (boundary !== "missing") {
      deliver({ type: "message_end", message: first });
    }
    deliver({
      type: "message_start",
      message: { role: "user", content: "New input." },
    });
    deliver({
      type: "message_end",
      message: { role: "user", content: "New input." },
    });
    deliver({
      type: "message_start",
      message: { role: "assistant", content: [] },
    });
    deliver({ type: "message_end", message: second });
    deliver({ type: "agent_end", messages: [first, second] });

    const completed = events.flatMap((event) =>
      event.type === "item/completed" && event.item.type === "agentMessage"
        ? [{ id: event.item.id, text: event.item.text }]
        : [],
    );
    const started = events.flatMap((event) =>
      event.type === "item/started" && event.item.type === "agentMessage"
        ? [event.item.id]
        : [],
    );
    console.log(JSON.stringify({ boundary, started, completed }));
    expect(completed.map((item) => item.text)).toEqual([
      "Original analysis.",
      "New response.",
    ]);
    expect(new Set(completed.map((item) => item.id)).size).toBe(2);
  },
);
