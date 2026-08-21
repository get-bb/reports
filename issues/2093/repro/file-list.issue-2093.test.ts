// Repro for get-bb/bb#2093: host.list_paths hides every dot-leading entry and
// node_modules unconditionally, so file search cannot find .github/workflows/ci.yml
// even though host.read_file serves the very same file.
//
// Run from apps/host-daemon:
//   pnpm exec vitest run src/command-handlers/file-list.issue-2093.test.ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listPathsRecursively } from "./file-list.js";
import { listHostPaths, readHostFile } from "./host-files.js";

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "bb-issue-2093-"));
  await fs.mkdir(path.join(root, ".github", "workflows"), { recursive: true });
  await fs.writeFile(
    path.join(root, ".github", "workflows", "ci.yml"),
    "name: ci\n",
  );
  await fs.mkdir(path.join(root, ".git"), { recursive: true });
  await fs.writeFile(path.join(root, ".git", "config"), "[core]\n");
  await fs.mkdir(path.join(root, "node_modules", "pkg"), { recursive: true });
  await fs.writeFile(path.join(root, "node_modules", "pkg", "index.js"), "");
  await fs.writeFile(path.join(root, ".env"), "SECRET=1\n");
  await fs.writeFile(path.join(root, "AGENTS.md"), "# agents\n");
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("issue #2093: host.list_paths hides dot paths", () => {
  it("walker: .github/workflows/ci.yml is walked (FAILS on fcada5a3b)", async () => {
    const listed = await listPathsRecursively({
      dir: root,
      root,
      includeFiles: true,
      includeDirectories: true,
    });
    const paths = listed.map((entry) => entry.path);
    // Control: ordinary files are listed.
    expect(paths).toContain("AGENTS.md");
    // Bug: every dot-leading name is skipped, so the workflow file is invisible.
    expect(paths).toContain(".github/workflows/ci.yml");
  });

  it("host.list_paths query=ci.yml returns nothing while host.read_file serves the same file (FAILS on fcada5a3b)", async () => {
    const search = await listHostPaths({
      type: "host.list_paths",
      path: root,
      query: "ci.yml",
      limit: 5,
      includeFiles: true,
      includeDirectories: false,
    });
    const read = await readHostFile({
      type: "host.read_file",
      path: path.join(root, ".github", "workflows", "ci.yml"),
    });
    // Same daemon, same root: read succeeds ...
    expect(read.content).toBe("name: ci\n");
    // ... but search cannot see it.
    expect(search.paths.map((entry) => entry.path)).toEqual([
      ".github/workflows/ci.yml",
    ]);
  });

  it("documents what the walker should still hide (.git, node_modules) - passes before and after", async () => {
    const listed = await listPathsRecursively({
      dir: root,
      root,
      includeFiles: true,
      includeDirectories: true,
    });
    const paths = listed.map((entry) => entry.path);
    expect(paths).not.toContain(".git/config");
    expect(paths).not.toContain("node_modules/pkg/index.js");
  });
});
