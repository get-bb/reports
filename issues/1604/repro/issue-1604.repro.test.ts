/**
 * Repro for get-bb/bb#1604: idle agent sessions are never reclaimed for
 * non-Codex providers under the daemon's DEFAULT policy.
 *
 * The daemon calls `reapIdleProviderSessions` every 5 minutes with
 * `idleForMs: 30min` and `providerSessionReapingEnabled` = the value of the
 * `providerSessionReaping` experiment, whose default is `false`
 * (packages/domain/src/experiments.ts). This test drives the runtime the way
 * the daemon does with the default policy and asserts what a user expects:
 * an idle, restorable Claude Code-shaped session is released.
 *
 * On main (16ceb3a54) the first assertion FAILS: `reapedSessions` is `[]`
 * because `findReapableIdleProviderSession` rejects every non-Codex thread
 * when the experiment is off. The second `it` shows the Codex baseline for
 * contrast (it passes), and the third shows the opt-in path (it passes).
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAgentRuntimeWithAdapters } from "./runtime.js";
import {
  createFakeAdapter,
  fullRuntimeOptions,
} from "./test/runtime-test-harness.js";

// Same idle policy the daemon uses (apps/host-daemon/src/app.ts:66).
const IDLE_PROVIDER_SESSION_REAP_AFTER_MS = 30 * 60 * 1000;

function writeRestorableProviderScript(scriptPath: string): void {
  writeFileSync(
    scriptPath,
    `const readline = require("readline");
const rl = readline.createInterface({ input: process.stdin });
process.on("SIGTERM", () => process.exit(0));
function send(m) { process.stdout.write(JSON.stringify(m) + "\\n"); }
rl.on("line", (line) => {
  const message = JSON.parse(line);
  const p = message.params ?? {};
  if (message.method === "initialize" || message.method === "skills/configure") {
    send({ jsonrpc: "2.0", id: message.id, result: { ok: true } });
    return;
  }
  if (message.method === "thread/start") {
    const providerThreadId = "prov-" + p.threadId;
    // Every real bridge (claude-code, codex, pi, ACP w/ loadSession) reports
    // sessionRestorable: true on thread/start.
    send({ jsonrpc: "2.0", id: message.id, result: { providerThreadId, sessionRestorable: true } });
    send({ jsonrpc: "2.0", method: "thread/identity", params: { threadId: p.threadId, providerThreadId } });
    return;
  }
  if (message.method === "thread/stop") {
    send({ jsonrpc: "2.0", id: message.id, result: { ok: true } });
    return;
  }
  send({ jsonrpc: "2.0", id: message.id, result: { ok: true } });
});`,
  );
}

describe("issue #1604: idle non-Codex sessions under the default reap policy", () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "bb-1604-"));
  });
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  async function startIdleThread(providerId: string) {
    const scriptPath = join(tmpDir, `${providerId}-provider.cjs`);
    writeRestorableProviderScript(scriptPath);
    const runtime = createAgentRuntimeWithAdapters({
      workspacePath: tmpDir,
      onEvent: () => {},
      onToolCall: async () => ({
        contentItems: [{ type: "inputText", text: "ok" }],
        success: true,
      }),
      adapterFactory: () => ({
        ...createFakeAdapter(scriptPath),
        displayName: providerId,
        id: providerId,
      }),
    });
    await runtime.startThread({
      environmentId: "env-1",
      threadId: `t-${providerId}`,
      projectId: "p1",
      providerId,
      options: fullRuntimeOptions,
    });
    return runtime;
  }

  it("BUG: a Claude Code session idle for > 30 min is NOT released with the default policy", async () => {
    const runtime = await startIdleThread("claude-code");
    try {
      const result = await runtime.reapIdleProviderSessions({
        idleForMs: IDLE_PROVIDER_SESSION_REAP_AFTER_MS,
        // Pretend the daemon sweep runs 31 minutes after the thread went idle.
        nowMs: Date.now() + IDLE_PROVIDER_SESSION_REAP_AFTER_MS + 60_000,
        providerSessionReapingEnabled: false, // defaultExperiments.providerSessionReaping
      });
      // Expected by the issue: the idle claude-code session is released.
      // Actual on main: [] — nothing is ever reaped for non-Codex providers.
      expect(result.reapedSessions).toEqual([
        expect.objectContaining({ providerId: "claude-code", threadId: "t-claude-code" }),
      ]);
      expect(runtime.hasThread("t-claude-code")).toBe(false);
    } finally {
      await runtime.shutdown();
    }
  });

  it("baseline: the same idle session IS released when the provider is codex", async () => {
    const runtime = await startIdleThread("codex");
    try {
      const result = await runtime.reapIdleProviderSessions({
        idleForMs: IDLE_PROVIDER_SESSION_REAP_AFTER_MS,
        nowMs: Date.now() + IDLE_PROVIDER_SESSION_REAP_AFTER_MS + 60_000,
        providerSessionReapingEnabled: false,
      });
      expect(result.reapedSessions).toEqual([
        expect.objectContaining({ providerId: "codex", threadId: "t-codex" }),
      ]);
      expect(runtime.hasThread("t-codex")).toBe(false);
    } finally {
      await runtime.shutdown();
    }
  });

  it("opt-in: with the providerSessionReaping experiment on, claude-code IS released", async () => {
    const runtime = await startIdleThread("claude-code");
    try {
      const result = await runtime.reapIdleProviderSessions({
        idleForMs: IDLE_PROVIDER_SESSION_REAP_AFTER_MS,
        nowMs: Date.now() + IDLE_PROVIDER_SESSION_REAP_AFTER_MS + 60_000,
        providerSessionReapingEnabled: true,
      });
      expect(result.reapedSessions).toEqual([
        expect.objectContaining({ providerId: "claude-code", threadId: "t-claude-code" }),
      ]);
      expect(runtime.hasThread("t-claude-code")).toBe(false);
    } finally {
      await runtime.shutdown();
    }
  });
});
