import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

const [repoRoot, ompBinary, profileDir, workspaceDir, dataDir] =
  process.argv.slice(2);

if (!repoRoot || !ompBinary || !profileDir || !workspaceDir || !dataDir) {
  process.stderr.write(
    "usage: node repro-v039-omp.mjs <repo> <omp> <profile> <workspace> <data-dir>\n",
  );
  process.exit(2);
}

const requireFromRepo = createRequire(
  pathToFileURL(resolve(repoRoot, "package.json")),
);
const tsxLoader = requireFromRepo.resolve("tsx");
const workerEntry = resolve(
  repoRoot,
  "packages/provider-bridge-protocol/src/bridge-worker-entry.ts",
);
const bridgeModule = resolve(
  repoRoot,
  "plugins/provider-acp/src/bridge/bridge.ts",
);
const proxyPath = resolve(dataDir, "omp-stdio-proxy.mjs");
const tracePath = resolve(dataDir, "omp-stdout.jsonl");

writeFileSync(
  proxyPath,
  `import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";

const [command, ...args] = process.argv.slice(2);
const trace = createWriteStream(process.env.BB_REPRO_OMP_STDOUT_TRACE);
const child = spawn(command, args, {
  env: process.env,
  stdio: ["pipe", "pipe", "pipe"],
});
process.stdin.pipe(child.stdin);
child.stdout.on("data", (chunk) => {
  trace.write(chunk);
  process.stdout.write(chunk);
});
child.stderr.pipe(process.stderr);
child.on("exit", (code) => {
  trace.end(() => process.exit(code ?? 1));
});
`,
);

const bridge = spawn(
  process.execPath,
  [
    "--conditions=source",
    "--import",
    tsxLoader,
    workerEntry,
    bridgeModule,
    "provider-acp",
    dataDir,
  ],
  { stdio: ["pipe", "pipe", "pipe"] },
);

let bridgeStderr = "";
bridge.stderr.on("data", (chunk) => {
  bridgeStderr += chunk.toString();
});

const responses = new Map();
createInterface({ input: bridge.stdout }).on("line", (line) => {
  process.stdout.write(`bridge stdout: ${line}\n`);
  try {
    const message = JSON.parse(line);
    if (message.id !== undefined && message.method === undefined) {
      responses.set(message.id, message);
    }
  } catch {
    // Keep non-JSON output in the transcript.
  }
});

function send(id, method, params) {
  bridge.stdin.write(
    `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`,
  );
}

async function waitForResponse(id, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = responses.get(id);
    if (response) return response;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 20));
  }
  throw new Error(
    `timed out waiting for response ${id}; bridge stderr: ${bridgeStderr}`,
  );
}

try {
  send(1, "initialize", {
    protocolVersion: 1,
    client: { name: "bb-repro", version: "0" },
  });
  await waitForResponse(1);

  send(2, "thread/start", {
    threadId: "thr_repro_2460",
    cwd: workspaceDir,
    instructionMode: "append",
    options: {
      permissionMode: "full",
      permissionScope: "full",
      approvalReviewer: null,
      permissionEscalation: null,
      providerOptions: {
        acpLaunchSpec: {
          displayName: "omp",
          command: process.execPath,
          args: [proxyPath, ompBinary, "acp"],
          env: {
            BB_REPRO_OMP_STDOUT_TRACE: tracePath,
            PI_CODING_AGENT_DIR: profileDir,
          },
        },
      },
    },
    dynamicTools: [
      {
        name: "repro_tool",
        description: "A minimal dynamic tool for the MCP bridge.",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  });
  const start = await waitForResponse(2);
  process.stdout.write(`thread.start result: ${JSON.stringify(start)}\n`);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  const rawAcpOutput = existsSync(tracePath)
    ? readFileSync(tracePath, "utf8").trim()
    : "trace file was not created";
  process.stdout.write(`raw ACP stdout:\n${rawAcpOutput}\n`);

  const bootstrap = spawnSync(
    process.execPath,
    [
      "--conditions=source",
      "--import",
      tsxLoader,
      workerEntry,
      "--mcp-stdio",
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );
  process.stdout.write(`bootstrap command exit: ${bootstrap.status}\n`);
  process.stdout.write(`bootstrap stdout: ${bootstrap.stdout.trim()}\n`);
  process.stdout.write(`bootstrap stderr: ${bootstrap.stderr.trim()}\n`);
  process.stdout.write(`bridge stderr: ${bridgeStderr.trim()}\n`);
} finally {
  bridge.kill("SIGKILL");
}
