import { describe, expect, it } from "vitest";
import { createDeltaAssembler } from "@bb/provider-bridge-protocol/assembler";
import type { ProviderRuntimeEvent } from "@bb/provider-bridge-protocol/bridge-kit";
import {
  ACP_TURN_COMPLETED_METHOD,
  ACP_TURN_STARTED_METHOD,
  ACP_UPDATE_METHOD,
} from "./bridge-protocol.js";
import { createAcpDeltaTranslator } from "./delta-translation.js";
import { acpPromptResultSchema } from "./wire.js";

const threadId = "synthetic-acp-failure";
const argumentsText = JSON.stringify({ key: "sample" });
const failureText = "Synthetic provider operation could not finish";

function harness() {
  const translator = createAcpDeltaTranslator({ cwd: "/workspace" });
  const assembler = createDeltaAssembler({
    providerId: "acp",
    entropyPrefix: "repro",
    textDeltaFlushMs: 0,
  });
  function send(method: string, params: Record<string, unknown>) {
    const event: ProviderRuntimeEvent = {
      jsonrpc: "2.0",
      method,
      params: { threadId, ...params },
    };
    return assembler.assemble({
      threadId,
      deltas: translator.translateAcpEvent(event, { threadId }),
    });
  }
  send(ACP_TURN_STARTED_METHOD, {});
  send(ACP_UPDATE_METHOD, {
    update: {
      sessionUpdate: "tool_call",
      toolCallId: "operation-1",
      title: "Lookup record",
      kind: "other",
      status: "in_progress",
      rawInput: { key: "sample" },
      content: [
        { type: "content", content: { type: "text", text: argumentsText } },
      ],
    },
  });
  return { send };
}

describe("issue 6775 ACP failure diagnostics", () => {
  it.each(["failed", "error"])(
    "does not turn a failure-valued stop reason (%s) into success",
    (stopReason) => {
      const session = harness();
      const response = acpPromptResultSchema.parse({ stopReason });
      const events = session.send(ACP_TURN_COMPLETED_METHOD, response);
      console.log(JSON.stringify({ scenario: stopReason, events }));
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "turn/completed", status: "failed" }),
          expect.objectContaining({
            type: "item/completed",
            item: expect.objectContaining({
              type: "toolCall",
              status: "failed",
            }),
          }),
        ]),
      );
    },
  );

  it("exposes the fallback when no tool terminal update arrives", () => {
    const session = harness();
    const events = session.send(ACP_TURN_COMPLETED_METHOD, {
      stopReason: "end_turn",
    });
    console.log(
      JSON.stringify({ scenario: "missing-terminal-update", events }),
    );
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "turn/completed",
          status: "completed",
        }),
        expect.objectContaining({
          type: "item/completed",
          item: expect.objectContaining({
            type: "toolCall",
            status: "completed",
            result: argumentsText,
          }),
        }),
      ]),
    );
  });

  it("preserves a tool failure that is actually delivered over ACP", () => {
    const session = harness();
    const events = session.send(ACP_UPDATE_METHOD, {
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: "operation-1",
        status: "failed",
        content: [
          { type: "content", content: { type: "text", text: failureText } },
        ],
      },
    });
    console.log(JSON.stringify({ scenario: "explicit-tool-failure", events }));
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "item/completed",
          item: expect.objectContaining({
            type: "toolCall",
            status: "failed",
            error: failureText,
          }),
        }),
      ]),
    );
  });

  it("fails the turn when the bridge delivers a provider error", () => {
    const session = harness();
    const events = session.send("error", { message: failureText });
    console.log(
      JSON.stringify({ scenario: "explicit-provider-error", events }),
    );
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "turn/completed", status: "failed" }),
        expect.objectContaining({
          type: "provider/error",
          detail: failureText,
        }),
      ]),
    );
  });
});
