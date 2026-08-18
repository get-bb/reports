import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createWorktree, removeDirectory } from "../src/provisioning.js";
import { runGit } from "../src/git.js";

// Issue #1770: `bb thread spawn --new-environment worktree --base-branch main`
// ends up here as createWorktree({ baseBranch: "main" }). The daemon runs
// `git worktree add -B <branch> <target> main`, which resolves the LOCAL
// `main` ref and never fetches. When the project checkout is behind
// origin/main the new worktree silently starts on the stale commit.
// A remote-qualified base ("origin/main") is fetched first and is fresh.

const tempDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function gitConfigUser(cwd: string) {
  await runGit(["config", "user.name", "BB Tests"], { cwd });
  await runGit(["config", "user.email", "bb@example.com"], { cwd });
}

/** Local checkout `repoPath` tracking bare `remotePath`; both at commit A. */
async function initRemoteBackedRepo() {
  const repoPath = await makeTempDir("bb-1770-repo-");
  await runGit(["init", "-b", "main"], { cwd: repoPath });
  await gitConfigUser(repoPath);
  await fs.writeFile(path.join(repoPath, "README.md"), "hello\n", "utf8");
  await runGit(["add", "."], { cwd: repoPath });
  await runGit(["commit", "-m", "A: initial"], { cwd: repoPath });
  const remotePath = await makeTempDir("bb-1770-remote-");
  await runGit(["init", "--bare"], { cwd: remotePath });
  await runGit(["remote", "add", "origin", remotePath], { cwd: repoPath });
  await runGit(["push", "-u", "origin", "main"], { cwd: repoPath });
  return { remotePath, repoPath };
}

/** Someone else pushes commit B to origin/main; the local checkout is now 1 behind. */
async function pushRemoteMainCommit(remotePath: string): Promise<string> {
  const cloneParent = await makeTempDir("bb-1770-clone-");
  const clonePath = path.join(cloneParent, "repo");
  await runGit(["clone", "--branch", "main", remotePath, clonePath], {
    cwd: cloneParent,
  });
  await gitConfigUser(clonePath);
  await fs.writeFile(path.join(clonePath, "remote.txt"), "remote\n", "utf8");
  await runGit(["add", "."], { cwd: clonePath });
  await runGit(["commit", "-m", "B: remote edit"], { cwd: clonePath });
  await runGit(["push", "origin", "main"], { cwd: clonePath });
  return (await runGit(["rev-parse", "HEAD"], { cwd: clonePath })).stdout.trim();
}

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await removeDirectory({ path: dir });
  }
});

describe("issue #1770: --base-branch <local name> ignores the remote", () => {
  it("creates the worktree from the stale local main without fetching (FAILS on main: documents the bug)", async () => {
    const { remotePath, repoPath } = await initRemoteBackedRepo();
    const remoteHead = await pushRemoteMainCommit(remotePath);
    const localMain = (
      await runGit(["rev-parse", "main"], { cwd: repoPath })
    ).stdout.trim();
    expect(localMain).not.toBe(remoteHead); // checkout is 1 behind origin

    const targetPath = path.join(await makeTempDir("bb-1770-wt-"), "feature");
    await createWorktree({
      sourcePath: repoPath,
      targetPath,
      branchName: "feature",
      baseBranch: "main", // what `bb thread spawn --base-branch main` sends
      timeoutMs: 900000,
    });

    const worktreeHead = (
      await runGit(["rev-parse", "HEAD"], { cwd: targetPath })
    ).stdout.trim();
    const originMainAfter = (
      await runGit(["rev-parse", "origin/main"], { cwd: repoPath })
    ).stdout.trim();

    // What a user asking for "main" expects: the branch as it exists on the
    // remote (or at least a fetch so origin/main is current). Both fail today.
    expect(originMainAfter).toBe(remoteHead); // no fetch happened
    expect(worktreeHead).toBe(remoteHead); // worktree is on stale local main
  });

  it("control: --base-branch origin/main is fetched and fresh (passes on main)", async () => {
    const { remotePath, repoPath } = await initRemoteBackedRepo();
    const remoteHead = await pushRemoteMainCommit(remotePath);
    const targetPath = path.join(await makeTempDir("bb-1770-wt-"), "feature");
    await createWorktree({
      sourcePath: repoPath,
      targetPath,
      branchName: "feature",
      baseBranch: "origin/main",
      timeoutMs: 900000,
    });
    const worktreeHead = (
      await runGit(["rev-parse", "HEAD"], { cwd: targetPath })
    ).stdout.trim();
    expect(worktreeHead).toBe(remoteHead);
  });
});
