/**
 * Repro for get-bb/bb#1918: the `bb-bridge` MCP server the ACP bridge hands
 * to the agent is spawned with the provider-bridge *worker* script as its
 * entry point (process.argv[1]) instead of the ACP plugin's own bridge
 * module, so the child dies on the worker's usage check and the agent sees
 * "bb-bridge: Transport closed".
 *
 * Unlike bridge.test.ts this spawns the bridge exactly like the agent runtime
 * does (node <bridge-worker-entry> <bridge module> <pluginId> <dataDir>) so
 * process.argv[1] inside the bridge is the worker, and then actually executes
 * the MCP server command the bridge advertised.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { afterEach, describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const BRIDGE_MODULE = resolve(here, "bridge.ts");
const FAKE_AGENT_PATH = resolve(here, "fake-acp-agent.mjs");
const WORKER_ENTRY = fileURLToPath(
  import.meta.resolve("@bb/provider-bridge-protocol/bridge-worker-entry"),
);
const TSX = import.meta.resolve("tsx");

interface Msg {
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { message: string };
}

let bridge: ChildProcess | undefined;
let dataDir: string;
let workspaceDir: string;
const log: Msg[] = [];
let nextId = 1;

function send(method: string, params: unknown): number {
  const id = nextId++;
  bridge!.stdin!.write(
    `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`,
  );
  return id;
}

async function waitFor<T>(
  pick: () => T | undefined,
  what: string,
  ms = 20_000,
): Promise<T> {
  const deadline = Date.now() + ms;
  for (;;) {
    const v = pick();
    if (v !== undefined) return v;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 20));
  }
}

function agentTexts(): string[] {
  const out: string[] = [];
  for (const m of log) {
    if (m.method !== "thread/event") continue;
    const ev = (m.params as { event?: Record<string, unknown> }).event;
    if (ev?.type === "item/agentMessage/delta") out.push(String(ev.delta));
  }
  return out;
}

afterEach(() => {
  bridge?.kill("SIGKILL");
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(workspaceDir, { recursive: true, force: true });
});

describe("#1918 bb-bridge MCP server entry point", () => {
  it("advertises an MCP server command that actually answers MCP initialize", async () => {
    dataDir = mkdtempSync(join(tmpdir(), "bb-1918-data-"));
    workspaceDir = mkdtempSync(join(tmpdir(), "bb-1918-ws-"));

    // Spawn the bridge the way packages/agent-runtime/src/provider-registry.ts does.
    const args = [
      "--conditions=source",
      "--import",
      TSX,
      WORKER_ENTRY,
      BRIDGE_MODULE,
      "provider-acp",
      dataDir,
    ];
    bridge = spawn(process.execPath, args, { stdio: ["pipe", "pipe", "pipe"] });
    bridge.stderr!.on("data", (d) => process.stderr.write(`[bridge] ${d}`));
    createInterface({ input: bridge.stdout! }).on("line", (line) => {
      try {
        log.push(JSON.parse(line) as Msg);
      } catch {
        /* ignore */
      }
    });

    const startId = send("thread/start", {
      threadId: "thread-1918",
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
    const startResp = await waitFor(
      () => log.find((m) => m.id === startId && m.method === undefined),
      "thread/start response",
    );
    expect(startResp.error).toBeUndefined();
    const providerThreadId = String(startResp.result!.providerThreadId);

    send("turn/start", {
      threadId: "thread-1918",
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
    const configText = await waitFor(
      () => agentTexts().find((t) => t.startsWith("mcp-server-config:")),
      "mcp-server-config echo",
    );
    const [cfg] = JSON.parse(
      configText.slice("mcp-server-config:".length),
    ) as {
      name: string;
      command: string;
      args: string[];
      env: { name: string; value: string }[];
    }[];
    console.log("advertised MCP server:", JSON.stringify(cfg, null, 2));
    expect(cfg.name).toBe("bb-bridge");

    // Now run the advertised MCP server exactly as an ACP agent would.
    const env = { ...process.env };
    for (const { name, value } of cfg.env) env[name] = value;
    const mcp = spawn(cfg.command, cfg.args, {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stderr = "";
    mcp.stderr!.on("data", (d) => {
      stderr += String(d);
    });
    const lines: string[] = [];
    createInterface({ input: mcp.stdout! }).on("line", (l) => lines.push(l));
    let exit: { code: number | null } | undefined;
    mcp.on("exit", (code) => {
      exit = { code };
    });
    mcp.stdin!.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "repro", version: "0" },
        },
      })}\n`,
    );

    await waitFor(
      () => (lines.length > 0 || exit !== undefined ? true : undefined),
      "MCP initialize response or exit",
      15_000,
    );
    mcp.kill("SIGKILL");
    console.log(
      "MCP child exit:",
      JSON.stringify(exit),
      "stderr:",
      stderr,
      "stdout lines:",
      lines,
    );

    // The bug: args[0] is the worker bootstrap, which exits 1 with a usage error.
    expect(cfg.args.some((a) => a.includes("bridge-worker"))).toBe(false);
    expect(stderr).not.toMatch(/provider bridge bootstrap usage/);
    expect(lines[0]).toContain('"serverInfo":{"name":"bb-bridge"');
  }, 60_000);
});
