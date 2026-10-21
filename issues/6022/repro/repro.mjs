import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const checkout = resolve(process.argv[2]);
const require = createRequire(join(checkout, "plugins/provider-claude-code/package.json"));
const { query } = await import(pathToFileURL(require.resolve("@anthropic-ai/claude-agent-sdk")));
const scratch = await mkdtemp(join(tmpdir(), "mcp-6022-"));
const home = join(scratch, "home");
const project = join(scratch, "project");
const configDir = join(home, ".claude");
await mkdir(configDir, { recursive: true });
await mkdir(project);
const serverPath = join(scratch, "server.mjs");
await writeFile(serverPath, `
import { McpServer } from ${JSON.stringify(pathToFileURL(require.resolve("@modelcontextprotocol/sdk/server/mcp.js")).href)};
import { StdioServerTransport } from ${JSON.stringify(pathToFileURL(require.resolve("@modelcontextprotocol/sdk/server/stdio.js")).href)};
const server = new McpServer({ name: "local-probe", version: "1.0.0" });
server.registerTool("ping", { description: "Local probe", inputSchema: {} }, async () => ({ content: [{ type: "text", text: "pong" }] }));
await server.connect(new StdioServerTransport());
`);
const configPath = join(configDir, ".claude.json");
await writeFile(configPath, JSON.stringify({ hasCompletedOnboarding: true, mcpServers: {} }));
const env = {
  HOME: home,
  CLAUDE_CONFIG_DIR: configDir,
  PATH: process.env.PATH,
  TMPDIR: scratch,
  LANG: "C.UTF-8",
  DISABLE_AUTOUPDATER: "1",
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
};
const sessions = [];
function start() {
  const end = new AbortController();
  async function* prompt() {
    await new Promise((resolvePrompt) => end.signal.addEventListener("abort", resolvePrompt, { once: true }));
  }
  const session = query({
    prompt: prompt(),
    options: {
      cwd: project,
      env,
      pathToClaudeCodeExecutable: "/usr/local/bin/claude",
      settingSources: ["user", "project", "local"],
      persistSession: false,
    },
  });
  sessions.push({ session, end });
  return session;
}
function names(statuses) {
  return statuses.map(({ name, status, tools }) => ({ name, status, tools: tools?.map(({ name: toolName }) => toolName) }));
}
try {
  const resident = start();
  await resident.initializationResult();
  console.log("initial:", JSON.stringify(names(await resident.mcpServerStatus())));
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 2500));
  const persisted = JSON.parse(await readFile(configPath, "utf8"));
  const config = { ...persisted, mcpServers: { "local-probe": { type: "stdio", command: process.execPath, args: [serverPath] } } };
  await writeFile(configPath, JSON.stringify(config));
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1500));
  const afterWrite = await resident.mcpServerStatus();
  console.log("after config write:", JSON.stringify(names(afterWrite)));
  const onDisk = JSON.parse(await readFile(configPath, "utf8"));
  console.log("persisted servers:", JSON.stringify(Object.keys(onDisk.mcpServers ?? {})));
  assert(onDisk.mcpServers?.["local-probe"], "positive control: server configuration remains persisted");
  try {
    await resident.reconnectMcpServer("local-probe");
    console.log("reconnect: succeeded");
  } catch (error) {
    console.log("reconnect:", error.message);
  }
  const fresh = start();
  await fresh.initializationResult();
  let freshStatus = [];
  for (let attempt = 0; attempt < 50; attempt += 1) {
    freshStatus = await fresh.mcpServerStatus();
    if (freshStatus.some(({ name, status }) => name === "local-probe" && status === "connected")) break;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }
  console.log("fresh session:", JSON.stringify(names(freshStatus)));
  assert(freshStatus.some(({ name, status }) => name === "local-probe" && status === "connected"), "positive control: fresh session connects to the new local MCP server");
  const residentStatus = await resident.mcpServerStatus();
  console.log("original session:", JSON.stringify(names(residentStatus)));
  assert(residentStatus.some(({ name, status }) => name === "local-probe" && status === "connected"), "positive control: SDK reconnect refreshes the existing process");
  assert(afterWrite.some(({ name, status }) => name === "local-probe" && status === "connected"), "automatic-refresh regression: running session did not discover the new server before an explicit SDK reconnect");
} finally {
  for (const { session, end } of sessions) {
    end.abort();
    session.close();
  }
  await rm(scratch, { recursive: true, force: true });
}
