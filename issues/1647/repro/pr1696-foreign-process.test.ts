// Probe for PR #1696: the cwd sweep SIGKILLs a process that bb never
// started (here one that ignores SIGTERM, as interactive shells do) purely
// because its cwd is inside the swept directory.
import { spawn } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { killProcessesWithCwdUnder } from "../src/index.js";

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe("PR #1696 cwd sweep vs foreign processes", () => {
  it("SIGKILLs a SIGTERM-ignoring process bb did not start", async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "bb-foreign-")));
    const foreign = spawn("sh", ["-c", 'trap "" TERM; exec sleep 300'], {
      cwd: dir,
      detached: true,
      stdio: "ignore",
    });
    foreign.unref();
    await new Promise((r) => setTimeout(r, 300));
    const pid = foreign.pid ?? 0;
    expect(isAlive(pid)).toBe(true);
    const t0 = Date.now();
    const killed = await killProcessesWithCwdUnder({ directory: dir });
    const elapsed = Date.now() - t0;
    console.log(
      JSON.stringify({ foreignPid: pid, killed, aliveAfterSweep: isAlive(pid), sweepMs: elapsed }),
    );
    expect(killed.map((k) => k.pid)).toContain(pid);
    expect(isAlive(pid)).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });
});
