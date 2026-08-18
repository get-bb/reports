// Repro for get-bb/bb#1595: a "bare repo + worktrees" project root
// (`<root>/.bare` bare clone, `<root>/.git` = "gitdir: ./.bare", worktrees
// as siblings) is not detected as a git repository by host-workspace, so the
// worktree flows are disabled / fail with not_git_repo.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getCheckoutRef,
  readGitRepositoryState,
  runGit,
} from "../src/git.js";
import { createWorktree } from "../src/provisioning.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

async function initBareLayout(): Promise<{ root: string }> {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "bb-1595-"));
  tempDirs.push(base);
  const origin = path.join(base, "origin");
  await fs.mkdir(origin);
  await runGit(["init", "-b", "main"], { cwd: origin });
  await runGit(["config", "user.name", "BB Tests"], { cwd: origin });
  await runGit(["config", "user.email", "bb@example.com"], { cwd: origin });
  await fs.writeFile(path.join(origin, "README.md"), "hello\n", "utf8");
  await runGit(["add", "."], { cwd: origin });
  await runGit(["commit", "-m", "Initial commit"], { cwd: origin });
  await runGit(["branch", "feature-a"], { cwd: origin });

  // ~/www/cosmos layout from the issue.
  const root = path.join(base, "cosmos");
  await fs.mkdir(root);
  await runGit(["clone", "--bare", origin, ".bare"], { cwd: root });
  await fs.writeFile(path.join(root, ".git"), "gitdir: ./.bare\n", "utf8");
  await runGit(["worktree", "add", "feature-a", "feature-a"], { cwd: root });
  return { root };
}

describe("bare repo + worktrees layout (#1595)", () => {
  it("git itself recognises the root as a repository", async () => {
    const { root } = await initBareLayout();
    const gitDir = await runGit(["rev-parse", "--git-dir"], { cwd: root });
    expect(gitDir.stdout.trim()).toBe(path.join(root, ".bare"));
    const bare = await runGit(["rev-parse", "--is-bare-repository"], {
      cwd: root,
    });
    expect(bare.stdout.trim()).toBe("true");
    const list = await runGit(["worktree", "list", "--porcelain"], {
      cwd: root,
    });
    expect(list.stdout).toContain("branch refs/heads/feature-a");
  });

  it("readGitRepositoryState() reports has_commits for the bare root", async () => {
    const { root } = await initBareLayout();
    // FAILS on 16ceb3a54: returns "not_git".
    expect(await readGitRepositoryState(root)).toBe("has_commits");
  });

  it("getCheckoutRef() does not report 'not a git repository'", async () => {
    const { root } = await initBareLayout();
    const checkout = await getCheckoutRef(root);
    // FAILS on 16ceb3a54: { kind: "unknown", reason: "Path is not a git repository" }
    // This is exactly what host.list_branches returns to the app, which then
    // disables "New worktree" in the environment picker.
    expect(checkout.kind).not.toBe("unknown");
  });

  it("createWorktree() can add a worktree from the bare root", async () => {
    const { root } = await initBareLayout();
    const targetPath = path.join(path.dirname(root), "wt-new");
    // FAILS on 16ceb3a54: throws WorkspaceError not_git_repo
    // "Cannot create a worktree because the source is not a Git repository".
    await expect(
      createWorktree({
        sourcePath: root,
        targetPath,
        branchName: "bb/new",
        baseBranch: "main",
        timeoutMs: 60_000,
      }),
    ).resolves.toEqual({ path: targetPath });
  });
});
