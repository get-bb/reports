// Drive an ACP agent directly over stdio: initialize -> session/new with the
// given bb-bridge MCP server args, then print the session/new response.
// usage: node drive-acp-agent.mjs <agentCmd> [agentArgs...] -- <mcpEntry> [mcpArgs...]
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sep = process.argv.indexOf("--");
const agentArgv = process.argv.slice(2, sep);
const mcpArgv = process.argv.slice(sep + 1);
const cwd = mkdtempSync(join(tmpdir(), "acp-drive-"));
const agent = spawn(agentArgv[0], agentArgv.slice(1), {
  cwd,
  stdio: ["pipe", "pipe", "pipe"],
});
agent.stderr.on("data", (d) => process.stderr.write(`[agent stderr] ${d}`));
const rl = createInterface({ input: agent.stdout });
let id = 0;
const pending = new Map();
function req(method, params) {
  id += 1;
  agent.stdin.write(
    JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n",
  );
  return new Promise((r) => pending.set(id, r));
}
rl.on("line", (line) => {
  let m;
  try {
    m = JSON.parse(line);
  } catch {
    return;
  }
  if (m.id !== undefined && m.method === undefined) {
    console.log("<-", JSON.stringify(m));
    pending.get(m.id)?.(m);
  } else if (m.method && m.id !== undefined) {
    console.log("<- request", m.method);
    agent.stdin.write(
      JSON.stringify({ jsonrpc: "2.0", id: m.id, result: {} }) + "\n",
    );
  } else if (m.method) {
    console.log("<- notification", m.method);
  }
});
const t = setTimeout(() => {
  console.log("TIMEOUT");
  agent.kill("SIGKILL");
  process.exit(2);
}, 60_000);
await req("initialize", {
  protocolVersion: 1,
  clientCapabilities: { fs: { readTextFile: false, writeTextFile: false } },
  clientInfo: { name: "repro", version: "0" },
});
const mcpServers = mcpArgv.length
  ? [
      {
        name: "bb-bridge",
        command: process.execPath,
        args: mcpArgv,
        env: [
          { name: "BB_ACP_DYNAMIC_TOOL_HOST", value: "127.0.0.1" },
          { name: "BB_ACP_DYNAMIC_TOOL_PORT", value: "1" },
          { name: "BB_ACP_DYNAMIC_TOOL_TOKEN", value: "x" },
          { name: "BB_ACP_DYNAMIC_TOOL_THREAD_ID", value: "t" },
          {
            name: "BB_ACP_DYNAMIC_TOOLS",
            value: JSON.stringify([
              {
                name: "update_environment_directory",
                description: "d",
                inputSchema: { type: "object" },
              },
            ]),
          },
        ],
      },
    ]
  : [];
console.log(
  "-> session/new mcpServers:",
  JSON.stringify(mcpServers.map((s) => ({ command: s.command, args: s.args }))),
);
const sn = await req("session/new", { cwd, mcpServers });
console.log(
  sn.error
    ? `session/new FAILED: ${JSON.stringify(sn.error)}`
    : `session/new OK: ${sn.result.sessionId}`,
);
if (!sn.error && process.env.DRIVE_PROMPT) {
  const pr = await req("session/prompt", {
    sessionId: sn.result.sessionId,
    prompt: [{ type: "text", text: process.env.DRIVE_PROMPT }],
  });
  console.log("session/prompt:", JSON.stringify(pr).slice(0, 600));
}
clearTimeout(t);
agent.kill("SIGKILL");
process.exit(sn.error ? 1 : 0);
