/**
 * Repro for the regression found while investigating get-bb/bb#1612.
 *
 * Since #1640 the ACP bridge runs under the provider-bridge bootstrap
 * (`node <bridge-worker-entry> <host.js> <pluginId> <dataDir>`). The bridge
 * hands Cursor an MCP server config built from `process.argv[1]`, which is now
 * the bootstrap, not the bridge artifact:
 *
 *   node <bridge-worker-entry> --mcp-stdio
 *
 * The bootstrap rejects that argv ("provider bridge bootstrap usage: ...") and
 * exits 1, so the ACP agent never sees bb's dynamic tools
 * (update_environment_directory, bb_workflow_run, ...).
 *
 * This test spawns the bridge exactly the way the runtime does from source,
 * starts a thread with one dynamic tool against the fake ACP agent, reads the
 * MCP server config the bridge passed to the agent, then runs that command
 * itself and asks it for `tools/list`.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const FAKE_AGENT_PATH = resolve(HERE, "fake-acp-agent.mjs");
const BRIDGE_MODULE_PATH = resolve(HERE, "bridge.ts");
const WORKER_ENTRY = fileURLToPath(
  import.meta.resolve("@bb/provider-bridge-protocol/bridge-worker-entry"),
);

interface JsonRpc {
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { message: string };
}

function jsonRpcClient(child: ChildProcess) {
  const pending = new Map<
    number,
    { resolve: (m: JsonRpc) => void; reject: (e: Error) => void }
  >();
  const notifications: JsonRpc[] = [];
  let nextId = 1;
  createInterface({ input: child.stdout! }).on("line", (line) => {
    if (!line.trim()) return;
    let msg: JsonRpc;
    try {
      msg = JSON.parse(line) as JsonRpc;
    } catch {
      return;
    }
    if (typeof msg.id === "number" && pending.has(msg.id)) {
      pending.get(msg.id)!.resolve(msg);
      pending.delete(msg.id);
      return;
    }
    if (msg.method !== undefined) notifications.push(msg);
  });
  child.on("exit", (code) => {
    for (const p of pending.values()) {
      p.reject(new Error(`process exited with code ${code} before replying`));
    }
    pending.clear();
  });
  return {
    notifications,
    request(method: string, params: unknown): Promise<JsonRpc> {
      const id = nextId++;
      return new Promise((resolveP, rejectP) => {
        pending.set(id, { resolve: resolveP, reject: rejectP });
        child.stdin!.write(
          `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`,
        );
      });
    },
  };
}

async function waitFor<T>(
  probe: () => T | undefined,
  what: string,
  timeoutMs = 20_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = probe();
    if (v !== undefined) return v;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

const children: ChildProcess[] = [];
let workspaceDir: string;
let dataDir: string;

afterEach(() => {
  for (const c of children.splice(0)) c.kill("SIGKILL");
  rmSync(workspaceDir, { recursive: true, force: true });
  rmSync(dataDir, { recursive: true, force: true });
});

describe("issue #1612 follow-up: dynamic-tool MCP server launched by the ACP bridge", () => {
  it("the MCP command the bridge hands the agent actually serves bb's dynamic tools", async () => {
    workspaceDir = mkdtempSync(join(tmpdir(), "bb-1612-ws-"));
    dataDir = mkdtempSync(join(tmpdir(), "bb-1612-data-"));

    // 1. Spawn the bridge the way the agent runtime does from source.
    const bridge = spawn(
      process.execPath,
      [
        "--conditions=source",
        "--import",
        import.meta.resolve("tsx"),
        WORKER_ENTRY,
        BRIDGE_MODULE_PATH,
        "provider-acp",
        dataDir,
      ],
      { stdio: ["pipe", "pipe", "pipe"], cwd: workspaceDir },
    );
    children.push(bridge);
    let bridgeStderr = "";
    bridge.stderr!.on("data", (d) => (bridgeStderr += String(d)));
    const rpc = jsonRpcClient(bridge);

    const init = await rpc
      .request("initialize", { protocolVersion: 1, client: { name: "bb", version: "1.0.0" } })
      .catch((e: Error) => ({ error: { message: `${e.message}: ${bridgeStderr}` } }));
    expect(init.error, bridgeStderr).toBeUndefined();

    // 2. Start a thread with ONE dynamic tool against the fake ACP agent.
    const start = await rpc.request("thread/start", {
      threadId: "thread-1612",
      cwd: workspaceDir,
      instructionMode: "append",
      options: {
        permissionMode: "full",
        permissionScope: "full",
        approvalReviewer: null,
        permissionEscalation: null,
        providerOptions: {
          acpLaunchSpec: {
            displayName: "Fake ACP",
            command: process.execPath,
            args: [FAKE_AGENT_PATH],
            env: {},
          },
        },
      },
      dynamicTools: [
        {
          name: "update_environment_directory",
          description: "Move this thread to another environment directory.",
          inputSchema: {
            type: "object",
            properties: { path: { type: "string" } },
            required: ["path"],
          },
        },
      ],
    });
    expect(start.error, bridgeStderr).toBeUndefined();
    const providerThreadId = (start.result as { providerThreadId: string })
      .providerThreadId;

    // 3. Ask the fake agent to echo the mcpServers config it received.
    await rpc.request("turn/start", {
      threadId: "thread-1612",
      providerThreadId,
      clientRequestId: "creq_abcdefghjk",
      options: {
        permissionMode: "full",
        permissionScope: "full",
        approvalReviewer: null,
        permissionEscalation: null,
      },
      input: [{ type: "text", text: "echo-mcp-server-config", mentions: [] }],
    });
    const configText = await waitFor(() => {
      for (const n of rpc.notifications) {
        if (n.method !== "thread/event") continue;
        const event = (n.params as { event?: Record<string, unknown> }).event;
        if (event?.type !== "item/agentMessage/delta") continue;
        const delta = String(event.delta ?? "");
        if (delta.startsWith("mcp-server-config:")) {
          return delta.slice("mcp-server-config:".length);
        }
      }
      return undefined;
    }, "mcp-server-config echo");
    const [mcpConfig] = JSON.parse(configText) as {
      name: string;
      command: string;
      args: string[];
      env: { name: string; value: string }[];
    }[];
    expect(mcpConfig.name).toBe("bb-bridge");

    // 4. Run that MCP server command ourselves, like Cursor would, and ask it
    //    for its tools. On main the process is `node <bridge-worker-entry>
    //    --mcp-stdio`, which prints the bootstrap usage and exits 1.
    const mcp = spawn(mcpConfig.command, mcpConfig.args, {
      cwd: workspaceDir,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...Object.fromEntries(mcpConfig.env.map((e) => [e.name, e.value])),
      },
    });
    children.push(mcp);
    let mcpStderr = "";
    mcp.stderr!.on("data", (d) => (mcpStderr += String(d)));
    const mcpRpc = jsonRpcClient(mcp);

    let toolNames: string[] | undefined;
    let failure: string | undefined;
    try {
      await mcpRpc.request("initialize", { protocolVersion: "2024-11-05" });
      const list = await mcpRpc.request("tools/list", {});
      toolNames = (list.result as { tools: { name: string }[] }).tools.map(
        (t) => t.name,
      );
    } catch (error) {
      failure = `${error instanceof Error ? error.message : String(error)}; stderr: ${mcpStderr.trim()}; command: ${mcpConfig.command} ${mcpConfig.args.join(" ")}`;
    }
    expect(failure).toBeUndefined();
    expect(toolNames).toEqual(["update_environment_directory"]);
  }, 60_000);
});
