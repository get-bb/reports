// Raw ACP probe against cursor-agent (no bb involved).
// usage: node acp-probe.mjs <model> <none|recursive|flat>
//   Spawns `cursor-agent --model <model> acp`, opens a session whose only MCP
//   server is ./stub-mcp.mjs (or no MCP server for "none"), sends one prompt
//   and prints the outcome of session/prompt.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import path from "node:path";

const [model = "cursor-grok-4.6-medium", schema = "recursive"] = process.argv.slice(2);
const here = path.dirname(fileURLToPath(import.meta.url));
const cwd = process.env.PROBE_CWD ?? "/tmp/bb-1612-scratch";

const child = spawn("cursor-agent", ["--model", model, "acp"], {
  cwd,
  stdio: ["pipe", "pipe", "inherit"],
});
let nextId = 1;
const pending = new Map();
const send = (m) => child.stdin.write(JSON.stringify(m) + "\n");
const request = (method, params) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    send({ jsonrpc: "2.0", id, method, params });
  });

let text = "";
createInterface({ input: child.stdout }).on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.id !== undefined && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) p.reject(msg.error); else p.resolve(msg.result);
    return;
  }
  if (msg.method === "session/update") {
    const u = msg.params?.update;
    if (u?.sessionUpdate === "agent_message_chunk" && u.content?.type === "text") text += u.content.text;
    else if (u?.sessionUpdate && u.sessionUpdate !== "agent_thought_chunk") console.log("[update]", u.sessionUpdate);
    return;
  }
  if (msg.id !== undefined && msg.method) {
    // Agent -> client request (permission, fs). Deny/skip everything.
    if (msg.method === "session/request_permission") {
      const opt = (msg.params?.options ?? []).find((o) => o.kind === "reject_once") ?? msg.params?.options?.[0];
      send({ jsonrpc: "2.0", id: msg.id, result: { outcome: { outcome: "selected", optionId: opt?.optionId } } });
    } else {
      send({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "unsupported" } });
    }
  }
});

const mcpServers =
  schema === "none"
    ? []
    : [{
        name: "probe",
        command: process.execPath,
        args: [path.join(here, "stub-mcp.mjs")],
        env: [{ name: "PROBE_SCHEMA", value: schema }],
      }];

const t0 = Date.now();
try {
  const init = await request("initialize", {
    protocolVersion: 1,
    clientInfo: { name: "bb-1612-probe", version: "0.0.0" },
    clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
  });
  console.log("agent:", JSON.stringify(init.agentInfo ?? init.agentCapabilities ?? {}).slice(0, 120));
  const s = await request("session/new", { cwd, mcpServers });
  console.log("session:", s.sessionId, "model=", model, "schema=", schema);
  const result = await request("session/prompt", {
    sessionId: s.sessionId,
    prompt: [{ type: "text", text: process.env.PROBE_PROMPT ?? "Reply only with ok." }],
  });
  console.log("RESULT stopReason=", result.stopReason, "text=", JSON.stringify(text.trim()), `(${Date.now() - t0}ms)`);
} catch (e) {
  console.log("ERROR", JSON.stringify(e), `(${Date.now() - t0}ms)`);
} finally {
  child.kill();
  process.exit(0);
}
