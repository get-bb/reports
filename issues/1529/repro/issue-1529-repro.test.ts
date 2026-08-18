// Repro for get-bb/bb#1529 (bb-side half).
//
// The wedge itself lives in Cursor's CLI: after the persistent shell's stored
// cwd is deleted, every spawn fails and Cursor's ACP adapter reports the tool
// call as `status: "completed"` with NO rawOutput/content (captured on the wire,
// see /tmp/bb-reports/issues/1529/repro/acp-cursor-updates.ndjson):
//
//   {"sessionUpdate":"tool_call_update","toolCallId":"call-...","status":"completed"}
//
// bb's ACP translator then synthesizes `exitCode: 0` from the status alone, so
// the bb timeline/CLI shows "Ran echo hi; git status — exit code 0" for a
// command that never ran. This test pins the fabricated exit code; it FAILS on
// main (exitCode is 0, expected to be omitted) and documents the wire shape.
import { describe, expect, it } from "vitest";
import type { ProviderRuntimeEvent } from "@bb/provider-bridge-protocol/bridge-kit";
import {
  ACP_TURN_STARTED_METHOD,
  ACP_UPDATE_METHOD,
} from "./bridge-protocol.js";
import { createAcpEventTranslator } from "./event-translation.js";

const THREAD_ID = "t-1529";
const context = { threadId: THREAD_ID };

function updateEvent(update: Record<string, unknown>): ProviderRuntimeEvent {
  return {
    jsonrpc: "2.0",
    method: ACP_UPDATE_METHOD,
    params: { threadId: THREAD_ID, update },
  };
}

describe("issue #1529: Cursor shell call with no result after cwd deletion", () => {
  it("does not fabricate exitCode 0 when the ACP update carries no output", () => {
    const translator = createAcpEventTranslator({ providerId: "acp-cursor" });
    translator.translateAcpEvent(
      {
        jsonrpc: "2.0",
        method: ACP_TURN_STARTED_METHOD,
        params: { threadId: THREAD_ID },
      },
      context,
    );

    // Exact shapes recorded from `cursor-agent acp` (2026.08.11-e8db854).
    translator.translateAcpEvent(
      updateEvent({
        sessionUpdate: "tool_call",
        toolCallId: "call-8d1faebb\nfc_366d93fb_0",
        title: "`echo hi; git status`",
        kind: "execute",
        status: "pending",
        rawInput: { command: "echo hi; git status" },
      }),
      context,
    );
    translator.translateAcpEvent(
      updateEvent({
        sessionUpdate: "tool_call_update",
        toolCallId: "call-8d1faebb\nfc_366d93fb_0",
        status: "in_progress",
      }),
      context,
    );
    const events = translator.translateAcpEvent(
      updateEvent({
        sessionUpdate: "tool_call_update",
        toolCallId: "call-8d1faebb\nfc_366d93fb_0",
        status: "completed",
        // NOTE: no `content`, no `rawOutput` — Cursor never got an exit status.
      }),
      context,
    );

    const completed = events.find((event) => event.type === "item/completed");
    expect(completed).toBeDefined();
    if (completed?.type !== "item/completed") throw new Error("unreachable");
    expect(completed.item.type).toBe("commandExecution");
    if (completed.item.type !== "commandExecution") throw new Error("unreachable");

    // Bug: bb reports exit code 0 for a command that produced no result at all.
    // Expected: exitCode omitted (unknown), and ideally status "failed".
    expect(completed.item.aggregatedOutput).toBeUndefined();
    expect(completed.item.exitCode).toBeUndefined();
  });

  it("uses rawOutput.exitCode when Cursor supplies one", () => {
    const translator = createAcpEventTranslator({ providerId: "acp-cursor" });
    translator.translateAcpEvent(
      {
        jsonrpc: "2.0",
        method: ACP_TURN_STARTED_METHOD,
        params: { threadId: THREAD_ID },
      },
      context,
    );
    translator.translateAcpEvent(
      updateEvent({
        sessionUpdate: "tool_call",
        toolCallId: "call-x",
        title: "`false`",
        kind: "execute",
        status: "pending",
        rawInput: { command: "false" },
      }),
      context,
    );
    const events = translator.translateAcpEvent(
      updateEvent({
        sessionUpdate: "tool_call_update",
        toolCallId: "call-x",
        status: "completed",
        rawOutput: { exitCode: 1, stdout: "", stderr: "" },
      }),
      context,
    );
    const completed = events.find((event) => event.type === "item/completed");
    if (completed?.type !== "item/completed") throw new Error("unreachable");
    if (completed.item.type !== "commandExecution") throw new Error("unreachable");
    // Bug: status "completed" wins and bb reports exit code 0 even though
    // Cursor's rawOutput says the command exited 1.
    expect(completed.item.exitCode).toBe(1);
  });
});
