import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const child = spawn("cursor-agent", ["acp"], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["pipe", "pipe", "inherit"],
});
const lines = createInterface({ input: child.stdout });
const pending = new Map();
let nextId = 1;

lines.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.id === undefined) return;
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  if (message.error) waiter.reject(new Error(message.error.message));
  else waiter.resolve(message.result);
});

function request(method, params) {
  const id = nextId++;
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

function thoughtOptions(configOptions) {
  return (configOptions ?? [])
    .filter((option) => option.category === "thought_level")
    .map((option) => ({
      id: option.id,
      values: (option.options ?? []).map((entry) => entry.value),
    }));
}

try {
  await request("initialize", {
    protocolVersion: 1,
    clientInfo: { name: "bb-issue-2503-repro", version: "1.0.0" },
    clientCapabilities: {
      fs: { readTextFile: false, writeTextFile: false },
      terminal: false,
      _meta: { parameterizedModelPicker: true },
    },
  });
  const session = await request("session/new", {
    cwd: process.cwd(),
    mcpServers: [],
  });
  const modelOption = session.configOptions.find(
    (option) => option.category === "model",
  );
  console.log(`model-count: ${modelOption.options.length}`);

  for (const model of [
    "grok-4.6",
    "gpt-5.6-sol",
    "claude-opus-5",
    "claude-fable-5",
    "composer-2.5",
  ]) {
    const start = performance.now();
    const state = await request("session/set_config_option", {
      sessionId: session.sessionId,
      configId: modelOption.id,
      value: model,
    });
    const elapsedMs = Math.round(performance.now() - start);
    console.log(
      JSON.stringify({ model, elapsedMs, thoughtLevel: thoughtOptions(state.configOptions) }),
    );
  }
} finally {
  child.kill("SIGTERM");
}
