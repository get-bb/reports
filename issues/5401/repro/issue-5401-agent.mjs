import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";

let pendingRequest;
let heldPrompt;
let cancelled = false;

function send(message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
}

function requestPermission(message, phase) {
  pendingRequest = { message, phase };
  send({
    id: "fixture-permission",
    method: "session/request_permission",
    params: {
      sessionId: "restored-session",
      toolCall: {
        toolCallId: "fixture-tool",
        title: "Read status",
        kind: "read",
        status: "pending",
      },
      options: [
        { optionId: "yes", name: "Allow once", kind: "allow_once" },
        { optionId: "no", name: "Reject once", kind: "reject_once" },
      ],
    },
  });
}

createInterface({ input: process.stdin }).on("line", (line) => {
  const message = JSON.parse(line);
  if (message.id === "fixture-permission" && pendingRequest) {
    appendFileSync(
      process.env.OUTCOME_LOG,
      `${JSON.stringify({ phase: pendingRequest.phase, response: message.result })}\n`,
    );
    const result =
      pendingRequest.phase === "load" ? {} : { stopReason: "end_turn" };
    send({ id: pendingRequest.message.id, result });
    pendingRequest = undefined;
    return;
  }
  switch (message.method) {
    case "initialize":
      send({
        id: message.id,
        result: {
          protocolVersion: 1,
          agentCapabilities: { loadSession: true },
        },
      });
      break;
    case "session/new":
      send({ id: message.id, result: { sessionId: "restored-session" } });
      break;
    case "session/load":
      requestPermission(message, "load");
      break;
    case "session/prompt":
      if (cancelled) {
        send({ id: message.id, result: { stopReason: "end_turn" } });
      } else if (["stop", "cancel"].includes(process.env.CASE_PHASE)) {
        heldPrompt = message;
        appendFileSync(process.env.READY_FILE, "ready\n");
      } else {
        requestPermission(message, "turn");
      }
      break;
    case "session/cancel":
      if (heldPrompt) {
        cancelled = true;
        requestPermission(heldPrompt, process.env.CASE_PHASE);
        heldPrompt = undefined;
      }
      break;
  }
});
