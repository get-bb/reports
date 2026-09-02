import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2];
const codexHome = join(root, "codex-home");
const workspace = join(root, "workspace");
mkdirSync(codexHome, { recursive: true });
mkdirSync(workspace, { recursive: true });

function launch() {
  const child = spawn("codex", ["app-server"], {
    cwd: workspace,
    env: { ...process.env, CODEX_HOME: codexHome },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const lines = createInterface({ input: child.stdout });
  const messages = [];
  const waiters = new Map();
  lines.on("line", (line) => {
    const message = JSON.parse(line);
    messages.push(message);
    if (message.id !== undefined && message.method === undefined) {
      waiters.get(message.id)?.(message);
      waiters.delete(message.id);
    }
  });
  function request(id, method, params) {
    const response = new Promise((resolve) => waiters.set(id, resolve));
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return response;
  }
  return { child, messages, request };
}

async function initialize(server) {
  return server.request(1, "initialize", {
    clientInfo: { name: "bb-repro", version: "1.0.0", title: null },
    capabilities: { experimentalApi: true },
  });
}

const first = launch();
await initialize(first);
const started = await first.request(2, "thread/start", {
  cwd: workspace,
  ephemeral: false,
});
const threadId = started.result.thread.id;
await first.request(3, "turn/start", {
  threadId,
  input: [{ type: "text", text: "ok", text_elements: [] }],
  approvalPolicy: "never",
});
await new Promise((resolve) => setTimeout(resolve, 1000));
first.child.kill("SIGTERM");
await new Promise((resolve) => first.child.once("close", resolve));

const second = launch();
await initialize(second);
const resumeParams =
  process.argv[3] === "true" ? { threadId, excludeTurns: true } : { threadId };
const resumed = await second.request(2, "thread/resume", resumeParams);
await new Promise((resolve) => setTimeout(resolve, 100));
console.log(JSON.stringify({ resumed, messages: second.messages }, null, 2));
second.child.kill("SIGTERM");
