// Minimal ACP (Agent Client Protocol) client: drives `cursor-agent acp` over
// stdio exactly like bb's provider-acp bridge does, and dumps every
// session/update notification so we can see the raw wire shape of the shell
// tool_call / tool_call_update messages. Usage:
//   node acp-client.mjs <cwd> <prompt-file> > out.ndjson
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";

const cwd = process.argv[2];
const prompt = readFileSync(process.argv[3], "utf8");
const child = spawn("cursor-agent", ["acp"], {
  cwd,
  stdio: ["pipe", "pipe", "inherit"],
});
let nextId = 1;
const pending = new Map();
function send(obj) {
  child.stdin.write(JSON.stringify(obj) + "\n");
}
function request(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    send({ jsonrpc: "2.0", id, method, params });
  });
}
const rl = createInterface({ input: child.stdout });
rl.on("line", (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  if (msg.id !== undefined && (msg.result !== undefined || msg.error)) {
    const p = pending.get(msg.id);
    if (p) {
      pending.delete(msg.id);
      msg.error ? p.reject(msg.error) : p.resolve(msg.result);
    }
    return;
  }
  if (msg.method === "session/request_permission") {
    const opt = msg.params.options.find((o) => o.kind === "allow_always") ??
      msg.params.options.find((o) => o.kind === "allow_once") ??
      msg.params.options[0];
    send({ jsonrpc: "2.0", id: msg.id, result: { outcome: { outcome: "selected", optionId: opt.optionId } } });
    return;
  }
  if (msg.method === "session/update") {
    const u = msg.params.update;
    if (u.sessionUpdate === "tool_call" || u.sessionUpdate === "tool_call_update") {
      console.log(JSON.stringify(u));
    }
    return;
  }
  if (msg.id !== undefined && msg.method) {
    // Unknown request from agent: answer with empty result.
    send({ jsonrpc: "2.0", id: msg.id, result: {} });
  }
});

const init = await request("initialize", {
  protocolVersion: 1,
  clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
});
console.error("initialized", JSON.stringify(init).slice(0, 200));
const session = await request("session/new", { cwd, mcpServers: [] });
console.error("session", session.sessionId);
const result = await request("session/prompt", {
  sessionId: session.sessionId,
  prompt: [{ type: "text", text: prompt }],
});
console.error("prompt done", JSON.stringify(result));
child.kill();
process.exit(0);
