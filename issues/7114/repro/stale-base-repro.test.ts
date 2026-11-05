import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { initRepo } from "@bb/test-helpers";
import { runGit } from "bb-environment-provider-host/workspace-git";
import { WorkspaceReads } from "./workspace-reads.js";

it("excludes upstream-only commits when a short base has a newer tracking ref", async ({
  onTestFinished,
}) => {
  const directory = await fs.mkdtemp(path.join(tmpdir(), "bb-base-repro-"));
  onTestFinished(() => fs.rm(directory, { recursive: true, force: true }));
  const repository = path.join(directory, "repository");
  const worktree = path.join(directory, "topic");
  await fs.mkdir(repository);
  await initRepo(repository);
  await runGit(["checkout", "-b", "upstream"], { cwd: repository });
  await fs.writeFile(path.join(repository, "upstream-only.txt"), "upstream\n");
  await runGit(["add", "."], { cwd: repository });
  await runGit(["commit", "-m", "Advance upstream"], { cwd: repository });
  await runGit(["update-ref", "refs/remotes/origin/main", "HEAD"], {
    cwd: repository,
  });
  await runGit(["checkout", "main"], { cwd: repository });
  await runGit(["worktree", "add", "-b", "topic", worktree, "origin/main"], {
    cwd: repository,
  });
  await fs.writeFile(path.join(worktree, "topic-only.txt"), "topic\n");
  await runGit(["add", "."], { cwd: worktree });
  await runGit(["commit", "-m", "Add topic work"], { cwd: worktree });
  const workspace = new WorkspaceReads(worktree, directory);
  const clean = await runGit(["status", "--porcelain"], { cwd: worktree });
  const [shortBase, remoteBase, explicitLocal] = await Promise.all(
    ["main", "origin/main", "refs/heads/main"].map(async (mergeBaseBranch) => {
      const result = await workspace.diffFiles({
        freshness: { work: mergeBaseBranch, refs: mergeBaseBranch },
        target: { type: "branch_committed", mergeBaseBranch },
        maxFiles: 100,
        ignoreWhitespace: false,
      });
      return result.files.map((file) => file.path).sort();
    }),
  );
  console.log(JSON.stringify({ clean: clean.stdout.trim(), shortBase, remoteBase, explicitLocal }));
  expect(clean.stdout.trim()).toBe("");
  expect(remoteBase).toEqual(["topic-only.txt"]);
  expect(explicitLocal).toEqual(["topic-only.txt", "upstream-only.txt"]);
  expect(shortBase).toEqual(["topic-only.txt"]);
});
