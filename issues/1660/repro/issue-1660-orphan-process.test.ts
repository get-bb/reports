// Repro for get-bb/bb#1660: destroying a managed worktree does not reap (or
// even notice) processes whose cwd is inside the worktree. The `sleep` below
// stands in for a dev server / watcher an agent left running with `&`.
//
// This test FAILS on main by design: the final assertion expects the process
// to be gone after `workspace.destroy()`, but bb only removes the directory.
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { provisionWorkspace } from "../src/index.js";
import { runGit } from "../src/git.js";

const tempDirs: string[] = [];
const children: number[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function initRepo(): Promise<string> {
  const repoPath = await makeTempDir("bb-1660-repo-");
  await runGit(["init", "-b", "main"], { cwd: repoPath });
  await runGit(["config", "user.name", "BB Tests"], { cwd: repoPath });
  await runGit(["config", "user.email", "bb@example.com"], { cwd: repoPath });
  await fs.writeFile(path.join(repoPath, "README.md"), "hello\n", "utf8");
  await runGit(["add", "."], { cwd: repoPath });
  await runGit(["commit", "-m", "Initial commit"], { cwd: repoPath });
  return repoPath;
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

afterEach(async () => {
  for (const pid of children.splice(0)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // already gone
    }
  }
  await Promise.all(
    tempDirs
      .splice(0)
      .map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

describe("#1660 managed worktree destroy vs processes rooted in it", () => {
  it("leaves a background process whose cwd is the worktree running after destroy", async () => {
    const repoPath = await initRepo();
    const parentDir = await makeTempDir("bb-1660-parent-");
    const targetPath = path.join(parentDir, "env");

    const ws = await provisionWorkspace({
      workspaceProvisionType: "managed-worktree",
      sourcePath: repoPath,
      targetPath,
      branchName: "bb/issue-1660",
      baseBranch: "main",
      timeoutMs: 900000,
    });
    expect(ws.managed).toBe(true);

    // Simulate `nohup pnpm dev &` from an agent turn: a detached long-lived
    // process whose cwd is the managed worktree.
    const child = spawn("sleep", ["600"], {
      cwd: ws.path,
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    if (child.pid === undefined) throw new Error("spawn failed");
    children.push(child.pid);
    expect(isAlive(child.pid)).toBe(true);

    await ws.destroy();

    // The directory is gone...
    await expect(fs.access(targetPath)).rejects.toThrow();

    // ...but the process rooted in it is still alive. On Linux its cwd now
    // reads "<path> (deleted)".
    if (process.platform === "linux") {
      const cwd = await fs.readlink(`/proc/${child.pid}/cwd`);
      expect(cwd).toBe(`${targetPath} (deleted)`);
    }

    // EXPECTED (per issue request #2): bb reaps or at least surfaces processes
    // rooted in a pruned managed worktree. ACTUAL on main: still running.
    expect(isAlive(child.pid)).toBe(false);
  });
});
