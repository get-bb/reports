import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { Workspace } from "../src/workspace.js";
import { runGit } from "../src/git.js";
import { readHostFile } from "../../../apps/host-daemon/src/command-handlers/host-files.js";

const roots: string[] = [];

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "issue-3905-"));
  roots.push(root);
  const nested = path.join(root, "modules", "client");
  const relative = "modules/client/sample.txt";
  await fs.mkdir(nested, { recursive: true });
  await runGit(["init", "-b", "main"], { cwd: root });
  await runGit(["config", "user.name", "Reproduction"], { cwd: root });
  await runGit(["config", "user.email", "repro@example.com"], { cwd: root });
  await fs.writeFile(path.join(root, relative), "before\n");
  await runGit(["add", "--all"], { cwd: root });
  await runGit(["commit", "-m", "Fixture baseline"], { cwd: root });
  await fs.writeFile(path.join(root, relative), "before\nafter\n");
  return { root, nested, relative };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

it("loads the same listed patch from repository and nested workspace roots", async () => {
  const { root, nested, relative } = await fixture();
  const target = { type: "uncommitted" } as const;
  for (const workspacePath of [root, nested]) {
    const workspace = new Workspace(workspacePath);
    const listing = await workspace.diffFiles({ target, maxFiles: 100 });
    expect(listing.files.map((file) => file.path)).toContain(relative);
    const patches = await workspace.diffPatch({ target, paths: [relative], maxBytesPerFile: 65536 });
    console.log(JSON.stringify({ nested: workspacePath === nested, listed: listing.files.map((file) => file.path), patch: patches[0]?.patch }));
    expect(patches[0]?.patch).toContain("+after");
  }
});

it("loads disk context using the diff route's path construction", async () => {
  const { root, nested, relative } = await fixture();
  const control = await readHostFile({ type: "host.read_file", rootPath: root, path: path.join(root, relative) });
  expect(control.content).toBe("before\nafter\n");
  const historical = await readHostFile({ type: "host.read_file", rootPath: nested, path: path.join(nested, relative), ref: "HEAD" });
  expect(historical.content).toBe("before\n");
  const disk = await readHostFile({ type: "host.read_file", rootPath: nested, path: path.join(nested, relative) });
  expect(disk.content).toBe("before\nafter\n");
});
