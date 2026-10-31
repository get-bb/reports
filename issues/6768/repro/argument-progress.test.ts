import { describe, expect, it } from "vitest";
import type { ThreadDelta } from "@bb/provider-bridge-protocol";
import { ACP_UPDATE_METHOD } from "./bridge-protocol.js";
import { createAcpDeltaTranslator } from "./delta-translation.js";
import type { AcpDialect } from "./dialect.js";
import type { AcpToolCallUpdateEvent } from "./wire.js";

const kinds = ["execute", "other"] as const;
const input = { command: "synthetic-operation", request: "sample-work" };
const argumentSnapshots = ['{"request":"sample', JSON.stringify(input)];
const realJson = '{"records":[7,11]}';

function createReplay(kind: (typeof kinds)[number], dialect?: AcpDialect) {
  const translator = createAcpDeltaTranslator({ cwd: "/workspace", dialect });
  function send(update: AcpToolCallUpdateEvent) {
    return translator.translateAcpEvent({
      jsonrpc: "2.0",
      method: ACP_UPDATE_METHOD,
      params: { threadId: "synthetic-thread", update },
    });
  }
  const opened = send({
    sessionUpdate: "tool_call",
    toolCallId: "synthetic-call",
    title: "Synthetic work",
    kind,
    status: "pending",
  });
  expect(opened).toContainEqual(expect.objectContaining({ kind: "item.open" }));
  function progress(text: string, rawInput?: typeof input) {
    return send({
      sessionUpdate: "tool_call_update",
      toolCallId: "synthetic-call",
      status: "in_progress",
      content: [{ type: "content", content: { type: "text", text } }],
      ...(rawInput === undefined ? {} : { rawInput }),
    });
  }
  return { send, progress };
}

function displayedText(deltas: ThreadDelta[]): string[] {
  return deltas.flatMap((delta) => {
    if (delta.kind === "command.outputSnapshot") return [delta.text];
    if (delta.kind === "item.progress" && delta.message !== undefined) {
      return [delta.message];
    }
    return [];
  });
}

describe("argument-phase text at the ACP translation boundary", () => {
  it.each(kinds)("does not present argument snapshots as %s output", (kind) => {
    const replay = createReplay(kind);
    const deltas = argumentSnapshots.flatMap((text) => replay.progress(text));
    deltas.push(...replay.progress(JSON.stringify(input), input));
    const observed = displayedText(deltas);
    console.log(JSON.stringify({ scenario: "default", kind, observed }));
    expect(observed).toEqual([]);
  });

  it.each(kinds)("lets a dialect suppress argument echoes for %s", (kind) => {
    const inputSeen = new Set<string>();
    const replay = createReplay(kind, {
      id: "synthetic-phase-aware",
      normalizeCommandEvent(event) {
        const collectingInput = !inputSeen.has(event.toolCallId);
        if (event.rawInput !== undefined) inputSeen.add(event.toolCallId);
        if (event.status === "completed") inputSeen.delete(event.toolCallId);
        return collectingInput ? { ...event, content: [] } : event;
      },
    });
    const deltas = argumentSnapshots.flatMap((text) => replay.progress(text));
    deltas.push(...replay.progress(JSON.stringify(input), input));
    deltas.push(...replay.progress(realJson));
    const observed = displayedText(deltas);
    const terminal = replay.send({
      sessionUpdate: "tool_call_update",
      toolCallId: "synthetic-call",
      status: "completed",
      content: [{ type: "content", content: { type: "text", text: realJson } }],
      rawOutput: realJson,
    });
    const close = terminal.find((delta) => delta.kind === "item.close");
    console.log(JSON.stringify({ scenario: "command-hook", kind, observed }));
    expect(close).toMatchObject({ resultText: realJson });
    expect(observed).toEqual([realJson]);
  });
});
