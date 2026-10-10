import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { Workspace } from "../src/workspace.js";
import { runGit } from "../src/git.js";

it("keeps status below a diagnostic payload budget with many untracked files", async () => {
  const temporaryRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "bb-status-probe-"),
  );
  try {
    const repositoryPath = path.join(temporaryRoot, "repository");
    const worktreePath = path.join(temporaryRoot, "worktree");
    await fs.mkdir(repositoryPath);
    await runGit(["init", "-b", "main"], { cwd: repositoryPath });
    await runGit(["config", "user.name", "Status Probe"], {
      cwd: repositoryPath,
    });
    await runGit(["config", "user.email", "probe@example.com"], {
      cwd: repositoryPath,
    });
    for (let fileIndex = 0; fileIndex < 19; fileIndex += 1) {
      await fs.writeFile(
        path.join(repositoryPath, `tracked-${fileIndex}.txt`),
        "base\n",
      );
    }
    await runGit(["add", "."], { cwd: repositoryPath });
    await runGit(["commit", "-m", "Probe baseline"], { cwd: repositoryPath });
    await runGit(["worktree", "add", "-b", "probe", worktreePath, "main"], {
      cwd: repositoryPath,
    });
    const workspace = new Workspace(worktreePath);
    const snapshots: Array<{
      sample: string;
      files: number;
      untracked: number;
      payloadBytes: number;
      durationMs: number;
      lineStatsComplete: boolean;
    }> = [];
    const snapshot = async (sample: string) => {
      const started = performance.now();
      const status = await workspace.getStatus({
        maxUntrackedLineStatFiles: 50,
        maxUntrackedLineStatBytes: 8 * 1024 * 1024,
      });
      snapshots.push({
        sample,
        files: status.workingTree.files.length,
        untracked: status.workingTree.files.filter(
          (entry) => entry.status === "??",
        ).length,
        payloadBytes: Buffer.byteLength(
          JSON.stringify({ outcome: "available", workspace: status }),
        ),
        durationMs: Math.round(performance.now() - started),
        lineStatsComplete: status.workingTree.lineStatsComplete,
      });
      return status;
    };
    await snapshot("clean");
    for (let fileIndex = 0; fileIndex < 19; fileIndex += 1) {
      await fs.writeFile(
        path.join(worktreePath, `tracked-${fileIndex}.txt`),
        "changed\n",
      );
    }
    await snapshot("tracked-only");
    const artifactDirectory = path.join(
      worktreePath,
      "probe-output",
      "iteration-000001",
      "captures-for-status-payload-measurement",
      "synthetic-browser-evidence-and-build-artifacts",
    );
    await fs.mkdir(artifactDirectory, { recursive: true });
    for (let batchStart = 0; batchStart < 7000; batchStart += 100) {
      await Promise.all(
        Array.from({ length: 100 }, (_, batchOffset) =>
          fs.writeFile(
            path.join(
              artifactDirectory,
              `artifact-${batchStart + batchOffset}.txt`,
            ),
            "artifact\n",
          ),
        ),
      );
      if (batchStart === 900) await snapshot("1000-artifacts");
    }
    const largeStatus = await snapshot("7000-artifacts");
    for (let updateIndex = 0; updateIndex < 3; updateIndex += 1) {
      await fs.writeFile(
        path.join(artifactDirectory, `update-${updateIndex}.txt`),
        "update\n",
      );
      await snapshot(`update-${updateIndex}`);
    }
    console.log("STATUS_PROBE", JSON.stringify(snapshots));
    expect(
      largeStatus.workingTree.files.filter((entry) => entry.status !== "??"),
    ).toHaveLength(19);
    expect(
      snapshots.find((entry) => entry.sample === "7000-artifacts")
        ?.payloadBytes,
    ).toBeLessThan(64 * 1024);
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
}, 60_000);
