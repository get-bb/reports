/**
 * Repro for get-bb/bb#1647: RuntimeProviderProcessManager.shutdown() only
 * signals the direct provider child. A grandchild the provider started
 * (dev server, MCP server, background job) survives with its cwd pointing at
 * the workspace that destroyEnvironment is about to delete.
 *
 * Expected on main: FAILS at `expect(isAlive(grandchildPid)).toBe(false)`.
 */
import { readlinkSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RuntimeProviderProcessManager } from "./runtime-provider-process.js";
import { RuntimeThreadIdentityRegistry } from "./runtime-thread-identity.js";
import { buildNodeScriptArgs } from "./test/fake-adapter.js";
import { fakeProviderScriptPath } from "./test/index.js";
import { createFakeAdapter } from "./test/runtime-test-harness.js";

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitFor(
  check: () => boolean,
  timeoutMs = 8000,
): Promise<boolean> {
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

  it("kills the grandchild a provider process started in the workspace", { timeout: 30_000 }, async () => {
    const workspacePath = mkdtempSync(join(tmpdir(), "bb-1647-ws-"));
    const stderr: string[] = [];
    const identityRegistry = new RuntimeThreadIdentityRegistry();
    let nextRequestId = 1;
    const base = createFakeAdapter(fakeProviderScriptPath);
    // Provider = `sh` that backgrounds a `sleep` (stand-in for `next dev`),
    // reports its pid on stderr, then execs the real fake provider script.
    const adapter: typeof base = {
      ...base,
      process: {
        command: "sh",
        args: [
          "-c",
          'sleep 300 & echo "grandchild=$!" >&2; exec node "$@"',
          "sh",
          ...buildNodeScriptArgs(fakeProviderScriptPath),
        ],
      },
      buildCommandPlan(command) {
        if (command.type === "initialize") {
          return { kind: "noop", reason: "spawn only" };
        }
        return base.buildCommandPlan(command);
      },
    };
    const manager = new RuntimeProviderProcessManager({
      additionalWorkspaceWriteRoots: [],
      adapterFactory: () => adapter,
      bridgeBundleDir: undefined,
      captureThreadExitState: (threadId) => ({
        activeTurnId: null,
        pendingTurnStart: false,
        providerThreadId: null,
        threadId,
      }),
      createProviderIdentityState: (providerId) =>
        identityRegistry.createProviderState({ providerId }),
      env: {},
      getNextRequestId: () => nextRequestId++,
      handleStdoutLine: () => undefined,
      onProcessExit: vi.fn(),
      onProviderIdentityWaitersInterrupted: (p) =>
        identityRegistry.resolvePendingIdentityWaiters(p.identity),
      onProviderThreadDetached: (threadId) =>
        identityRegistry.clearThread(threadId),
      onStderr: (line) => stderr.push(line),
      skillRoots: [],
      workspacePath,
    });

    await manager.ensureProvider({ processKey: "fake", providerId: "fake" });

    const providerPid =
      manager.requireProviderProcess({
        processKey: "fake",
        providerId: "fake",
      }).child.pid ?? 0;
    cleanupPids.push(providerPid);

    expect(
      await waitFor(() => stderr.join("").includes("grandchild=")),
    ).toBe(true);
    const grandchildPid = Number(
      /grandchild=(\d+)/.exec(stderr.join(""))?.[1] ?? 0,
    );
    cleanupPids.push(grandchildPid);
    expect(isAlive(grandchildPid)).toBe(true);
    if (process.platform === "linux") {
      expect(readlinkSync(`/proc/${grandchildPid}/cwd`)).toBe(workspacePath);
    }

    // This is exactly what RuntimeManager.destroyEnvironment does before
    // `workspace.destroy()` removes the directory.
    await manager.shutdown();
    expect(await waitFor(() => !isAlive(providerPid))).toBe(true);

    // The workspace is now removed by destroyEnvironment; the grandchild keeps
    // running with a cwd of "<workspace> (deleted)".
    rmSync(workspacePath, { recursive: true, force: true });
    const grandchildCwd =
      process.platform === "linux" && isAlive(grandchildPid)
        ? readlinkSync(`/proc/${grandchildPid}/cwd`)
        : "(process gone)";
    console.log(
      `provider pid ${providerPid} alive=${isAlive(providerPid)}; ` +
        `grandchild pid ${grandchildPid} alive=${isAlive(grandchildPid)} cwd=${grandchildCwd}`,
    );
    expect(isAlive(grandchildPid)).toBe(false);
  });
});
