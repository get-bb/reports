import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAgentRuntimeWithAdapters } from "./runtime.js";
import { createFakeAdapter, fullRuntimeOptions } from "./test/runtime-test-harness.js";

// Issue #1363: "Provider processes need one host-daemon lease owner tied to
// active turns". The issue's proposed invariant is that every resident
// provider session maps to an active turn or a bounded lease, and that after
// the lease TTL there are zero unmatched sessions.
//
// This test encodes that invariant against the runtime's only lease-like
// mechanism, `reapIdleProviderSessions`, using the policy the host daemon
// ships by default (`providerSessionReapingEnabled: false`, i.e. the
// "Idle provider session release" experiment OFF) and a 60-minute idle
// window (twice IDLE_PROVIDER_SESSION_REAP_AFTER_MS).
//
// It FAILS on main: for every provider except Codex, the sweep returns []
// no matter how long the session has been idle, so N idle threads keep N
// resident provider sessions (for claude-code: N `claude` CLI processes)
// until the thread is archived/stopped or the daemon restarts.

const RESTORABLE_PROVIDER_SCRIPT = `const fs = require("fs");
const readline = require("readline");
const rl = readline.createInterface({ input: process.stdin });
const threads = new Map();
let nextTurn = 1;
function send(m) { process.stdout.write(JSON.stringify(m) + "\\n"); }
process.on("SIGTERM", () => process.exit(0));
rl.on("line", (line) => {
  const msg = JSON.parse(line);
  const p = msg.params || {};
  if (msg.method === "initialize" || msg.method === "skills/configure") {
    send({ jsonrpc: "2.0", id: msg.id, result: { ok: true } });
    return;
  }
  if (msg.method === "thread/start") {
    const providerThreadId = "prov-" + p.threadId;
    threads.set(p.threadId, providerThreadId);
    // A graduated bridge (claude-code, acp, pi) reports sessionRestorable.
    send({ jsonrpc: "2.0", id: msg.id, result: { providerThreadId, sessionRestorable: true } });
    send({ jsonrpc: "2.0", method: "thread/identity", params: { threadId: p.threadId, providerThreadId } });
    return;
  }
  if (msg.method === "turn/start") {
    const providerThreadId = threads.get(p.threadId);
    const turnId = "turn-" + nextTurn++;
    send({ jsonrpc: "2.0", id: msg.id, result: { ok: true } });
    send({ jsonrpc: "2.0", method: "turn/started", params: { threadId: p.threadId, providerThreadId, turnId } });
    send({ jsonrpc: "2.0", method: "turn/completed", params: { threadId: p.threadId, providerThreadId, turnId, status: "completed" } });
    return;
  }
  if (msg.method === "thread/stop") {
    threads.delete(p.threadId);
    send({ jsonrpc: "2.0", id: msg.id, result: {} });
    return;
  }
  if (msg.id !== undefined) {
    send({ jsonrpc: "2.0", id: msg.id, result: {} });
  }
});
`;

describe("issue #1363: idle provider sessions are bounded by a lease", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "bb-issue-1363-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("releases every idle non-Codex session after the idle TTL under the shipped default policy", async () => {
    const scriptPath = join(tmpDir, "restorable-provider.cjs");
    writeFileSync(scriptPath, RESTORABLE_PROVIDER_SCRIPT);
    const runtime = createAgentRuntimeWithAdapters({
      workspacePath: tmpDir,
      onEvent: () => {},
      onToolCall: async () => ({
        contentItems: [{ type: "inputText", text: "ok" }],
        success: true,
      }),
      adapterFactory: () => ({
        ...createFakeAdapter(scriptPath),
        displayName: "Claude Code",
        id: "claude-code",
      }),
    });

    try {
      const threadIds = ["t1", "t2", "t3"];
      for (const threadId of threadIds) {
        await runtime.startThread({
          environmentId: "env-1",
          threadId,
          projectId: "p1",
          providerId: "claude-code",
          options: fullRuntimeOptions,
        });
      }
      for (const threadId of threadIds) {
        expect(runtime.hasThread(threadId)).toBe(true);
        expect(runtime.getActiveTurnId(threadId)).toBeNull();
      }

      // Same arguments the host daemon's reaper passes
      // (apps/host-daemon/src/app.ts startIdleProviderSessionReaper), with the
      // experiment OFF (default) and the sessions idle for 60 minutes.
      const result = await runtime.reapIdleProviderSessions({
        idleForMs: 30 * 60 * 1000,
        nowMs: Date.now() + 60 * 60 * 1000,
        providerSessionReapingEnabled: false,
      });

      // Issue #1363 acceptance evidence: "Zero unmatched provider processes
      // after the lease TTL." On main this is [] and all three sessions stay
      // resident.
      expect(result.reapedSessions.map((s) => s.threadId).sort()).toEqual(
        threadIds,
      );
      for (const threadId of threadIds) {
        expect(runtime.hasThread(threadId)).toBe(false);
      }
    } finally {
      await runtime.shutdown();
    }
  });
});
