#!/usr/bin/env node
// Minimal ACP agent for get-bb/bb#2122.
//
// Answers initialize / session/new / session/prompt, and after the prompt
// result has been returned (no prompt in flight), emits an *agent-initiated*
// turn: a user_message_chunk (OMP echoes the injected async-job result),
// agent_message_chunks, and a tool_call that completes. This is the wire
// shape OMP's async-job auto-delivery produces.
import { createInterface } from "node:readline";

const sessionId = `unprompted-${process.pid}`;
const delayMs = Number(process.env.UNPROMPTED_DELAY_MS ?? "150");
function send(m) {
  process.stdout.write(JSON.stringify(m) + "\n");
}
function update(update) {
  send({ jsonrpc: "2.0", method: "session/update", params: { sessionId, update } });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function unpromptedTurn() {
  await sleep(delayMs);
  update({
    sessionUpdate: "user_message_chunk",
    content: { type: "text", text: "[bg_4 finished] exit 0" },
  });
  update({
    sessionUpdate: "agent_message_chunk",
    content: { type: "text", text: "UNPROMPTED: job bg_4 finished, " },
  });
  update({
    sessionUpdate: "tool_call",
    toolCallId: "unprompted-tool-1",
    title: "cat result.txt",
    kind: "read",
    status: "pending",
    rawInput: { path: "result.txt" },
  });
  update({
    sessionUpdate: "tool_call_update",
    toolCallId: "unprompted-tool-1",
    status: "completed",
    content: [{ type: "content", content: { type: "text", text: "42" } }],
  });
  if (process.env.UNPROMPTED_ASK_PERMISSION === "1") {
    // An agent-initiated tool call that needs approval (non-yolo agents).
    send({
      jsonrpc: "2.0",
      id: 9001,
      method: "session/request_permission",
      params: {
        sessionId,
        toolCall: {
          toolCallId: "unprompted-tool-2",
          title: "rm -rf build",
          kind: "execute",
          rawInput: { command: "rm -rf build" },
        },
        options: [
          { optionId: "yes", name: "Allow", kind: "allow_once" },
          { optionId: "no", name: "Deny", kind: "reject_once" },
        ],
      },
    });
  }
  update({
    sessionUpdate: "agent_message_chunk",
    content: { type: "text", text: "the answer is 42." },
  });
  if (process.env.UNPROMPTED_DONE_FILE) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(process.env.UNPROMPTED_DONE_FILE, "done\n");
  }
  if (process.env.UNPROMPTED_EXIT_AFTER === "1") {
    // Crash mid agent-initiated turn (e.g. the agent process dies).
    await sleep(100);
    process.exit(3);
  }
}

const rl = createInterface({ input: process.stdin, terminal: false });
rl.on("line", (line) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  if (message.method === undefined) {
    // Responses to agent requests: record the permission outcome.
    if (message.id === 9001) {
      update({
        sessionUpdate: "agent_message_chunk",
        content: {
          type: "text",
          text: ` permission:${JSON.stringify(message.result ?? message.error)}`,
        },
      });
      if (process.env.UNPROMPTED_DONE_FILE) {
        import("node:fs").then(({ writeFileSync }) =>
          writeFileSync(process.env.UNPROMPTED_DONE_FILE + ".perm", "done\n"),
        );
      }
    }
    return;
  }
  switch (message.method) {
    case "initialize":
      send({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          protocolVersion: 1,
          agentCapabilities: { loadSession: false, promptCapabilities: { image: false } },
        },
      });
      return;
    case "session/new":
      send({ jsonrpc: "2.0", id: message.id, result: { sessionId } });
      return;
    case "session/prompt":
      update({
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: "PROMPTED: started bg_4" },
      });
      send({ jsonrpc: "2.0", id: message.id, result: { stopReason: "end_turn" } });
      // Agent-initiated follow-up with no prompt in flight.
      void unpromptedTurn();
      return;
    case "session/cancel":
      return;
    default:
      if (message.id !== undefined) {
        send({
          jsonrpc: "2.0",
          id: message.id,
          error: { code: -32601, message: `Unknown method ${message.method}` },
        });
      }
  }
});
rl.on("close", () => process.exit(0));
