import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRemoteBranches, runGit } from "../src/git.js";

const tempDirs: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    tempDirs
      .splice(0)
      .map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

describe("background remote refresh", () => {
  it("does not invoke an SSH askpass helper", async () => {
    const repoPath = await fs.mkdtemp(
      path.join(os.tmpdir(), "bb-background-fetch-"),
    );
    tempDirs.push(repoPath);
    await runGit(["init", "-b", "main"], { cwd: repoPath });
    await runGit(
      ["remote", "add", "origin", "ssh://example.invalid/repository"],
      { cwd: repoPath },
    );

    const markerPath = path.join(repoPath, "askpass-called");
    const askpassPath = path.join(repoPath, "askpass.sh");
    const sshPath = path.join(repoPath, "ssh.sh");
    await fs.writeFile(
      askpassPath,
      `#!/bin/sh\nprintf 'called\\n' >> ${JSON.stringify(markerPath)}\nexit 1\n`,
      { encoding: "utf8", mode: 0o755 },
    );
    await fs.writeFile(
      sshPath,
      `#!/bin/sh\nfor argument in "$@"; do\n  if [ "$argument" = "BatchMode=yes" ]; then\n    exit 1\n  fi\ndone\n"$SSH_ASKPASS"\nexit 1\n`,
      { encoding: "utf8", mode: 0o755 },
    );
    vi.stubEnv("GIT_SSH_COMMAND", sshPath);
    vi.stubEnv("SSH_ASKPASS", askpassPath);
    vi.stubEnv("SSH_ASKPASS_REQUIRE", "force");

    await expect(
      fetchRemoteBranches(repoPath, { timeoutMs: 2_000 }),
    ).resolves.toEqual({ status: "failed" });
    await expect(fs.access(markerPath)).rejects.toThrow();
  });
});
