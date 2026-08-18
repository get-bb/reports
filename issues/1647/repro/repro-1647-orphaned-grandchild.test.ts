// Repro for get-bb/bb#1647: RuntimeProviderProcessManager.shutdown() (the
// path RuntimeManager.destroyEnvironment() takes before removing the worktree)
// signals only the direct provider child (`child.kill("SIGTERM")`). A process
// the provider started (dev server, MCP server, `nohup ... &`) is never
// signalled and keeps running with a cwd inside the removed workspace.
//
// On main (16ceb3a54) the final assertion FAILS: the grandchild is still alive
// after shutdown() resolves.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProviderAdapter } from "./provider-adapter.js";
import { RuntimeProviderProcessManager } from "./runtime-provider-process.js";
import { RuntimeThreadIdentityRegistry } from "./runtime-thread-identity.js";
import { createFakeAdapter } from "./test/runtime-test-harness.js";

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitFor(check: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) return false;
    await new Promise((r) => setTimeout(r, 25));
  }
  return true;
}

describe("#1647 provider shutdown leaves grandchildren running", () => {
  const cleanupPids: number[] = [];
  afterEach(() => {
    for (const pid of cleanupPids) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // gone
      }
    }
  });

  it("grandchild of the provider process survives RuntimeProviderProcessManager.shutdown()", async () => {
    const workspacePath = mkdtempSync(join(tmpdir(), "bb-1647-ws-"));
    let grandchildPid = 0;

    // A "provider CLI" that starts a background job (like an agent's Bash tool
    // running `nohup next dev &`) and then idles, exiting cleanly on SIGTERM.
    const base = createFakeAdapter("unused");
    const adapter: ProviderAdapter = {
      ...base,
      process: {
        command: "sh",
        args: [
          "-c",
          'sleep 300 >/dev/null 2>&1 & echo "GRANDCHILD=$!" 1>&2; trap "exit 0" TERM; while :; do sleep 0.1; done',
        ],
      },
      buildCommandPlan(command) {
        if (command.type === "initialize") {
          return { kind: "noop", reason: "initialized by process spawn" };
        }
        return base.buildCommandPlan(command);
      },
    };

    const identityRegistry = new RuntimeThreadIdentityRegistry();
    let nextRequestId = 1;
    const manager = new RuntimeProviderProcessManager({
      additionalWorkspaceWriteRoots: [],
      adapterFactory: () => adapter,
      bridgeBundleDir: undefined,
      captureThreadExitState: (threadId) => ({
        activeTurnId: null,
        pendingTurnStart: false,
        providerThreadId: identityRegistry.getProviderThreadId(threadId) ?? null,
        threadId,
      }),
      createProviderIdentityState: (providerId) =>
        identityRegistry.createProviderState({ providerId }),
      env: undefined,
      getNextRequestId: () => nextRequestId++,
      handleStdoutLine: () => undefined,
      onProcessExit: vi.fn(),
      onProviderIdentityWaitersInterrupted: (providerProcess) =>
        identityRegistry.resolvePendingIdentityWaiters(providerProcess.identity),
      onProviderThreadDetached: (threadId) => identityRegistry.clearThread(threadId),
      onStderr: (line) => {
        const match = /GRANDCHILD=(\d+)/.exec(line);
        if (match) grandchildPid = Number(match[1]);
      },
      skillRoots: [],
      workspacePath,
    });

    await manager.ensureProvider({ processKey: "fake#bridge:x", providerId: "fake" });
    const providerProcess = manager.requireProviderProcess({
      processKey: "fake#bridge:x",
      providerId: "fake",
    });
    expect(await waitFor(() => grandchildPid > 0, 5000)).toBe(true);
    cleanupPids.push(grandchildPid, providerProcess.child.pid ?? 0);
    expect(isAlive(grandchildPid)).toBe(true);

    // This is what RuntimeManager.destroyEnvironment() calls before
    // workspace.destroy() removes the worktree directory.
    await manager.shutdown();
    rmSync(workspacePath, { recursive: true, force: true });

    // The direct child is gone ...
    expect(await waitFor(() => !isAlive(providerProcess.child.pid ?? 0), 5000)).toBe(true);
    // ... but its child (the "dev server") is still running with a deleted cwd.
    // FAILS on main: expected false, received true.
    expect(isAlive(grandchildPid)).toBe(false);
  });
});
