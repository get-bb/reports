// Repro for get-bb/bb#1779: the workspace-root watch of an "umbrella" root
// (a git repo that contains untracked nested checkouts with node_modules/.git)
// registers an inotify watch on every nested directory because the ignore set
// handed to @parcel/watcher is only the ROOT-level `!!` entries from
// `git status --ignored=matching --untracked-files=normal` plus the path ".git".
//
// Linux only: it reads the real inotify watch count from /proc/self/fdinfo.
// Run from packages/host-watcher:
//   pnpm exec vitest run test/umbrella-workspace-watch-1779.test.ts
import { execFile } from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import parcelWatcher from "@parcel/watcher";
import { afterEach, describe, expect, it, vi } from "vitest";
import { watchWorkspaceStatus } from "../src/watch-status.js";

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];

const NESTED_REPOS = 4;
const PACKAGES_PER_NESTED_REPO = 300;
// Every nested repo contributes: 1 (repo dir) + node_modules + 300 pkg + 300 pkg/lib
// + the .git internals (~10 dirs). Total directories under the root is a few
// thousand -- big enough to show the effect, small enough to be quick.

async function git(cwd: string, ...args: string[]): Promise<void> {
  await execFileAsync("git", args, { cwd, encoding: "utf8" });
}

async function initRepo(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  await git(dir, "init", "-q", "-b", "main");
  await git(dir, "config", "user.name", "BB Tests");
  await git(dir, "config", "user.email", "bb@example.com");
  await fs.writeFile(path.join(dir, "README.md"), "hello\n");
  await git(dir, "add", "README.md");
  await git(dir, "commit", "-q", "-m", "init");
}

async function buildUmbrellaRoot(): Promise<{
  root: string;
  nestedDirCount: number;
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bb-1779-umbrella-"));
  tempDirs.push(root);
  await initRepo(root);
  let nestedDirCount = 0;
  for (let i = 0; i < NESTED_REPOS; i += 1) {
    const child = path.join(root, "apps", `child-${i}`);
    await initRepo(child);
    // The nested repo ignores its own node_modules, like every real project.
    await fs.writeFile(path.join(child, ".gitignore"), "node_modules/\n");
    await git(child, "add", ".gitignore");
    await git(child, "commit", "-q", "-m", "ignore node_modules");
    for (let p = 0; p < PACKAGES_PER_NESTED_REPO; p += 1) {
      const pkgLib = path.join(child, "node_modules", `pkg-${p}`, "lib");
      await fs.mkdir(pkgLib, { recursive: true });
      await fs.writeFile(path.join(pkgLib, "index.js"), "module.exports={}\n");
      nestedDirCount += 2;
    }
  }
  return { root, nestedDirCount };
}

function countInotifyWatches(): number {
  const fdinfoDir = "/proc/self/fdinfo";
  let count = 0;
  for (const fd of fsSync.readdirSync(fdinfoDir)) {
    try {
      const info = fsSync.readFileSync(path.join(fdinfoDir, fd), "utf8");
      count += info
        .split("\n")
        .filter((line) => line.startsWith("inotify wd:")).length;
    } catch {
      // fd closed between readdir and read
    }
  }
  return count;
}

function rssMb(): number {
  return Math.round(process.memoryUsage().rss / 1024 / 1024);
}

afterEach(async () => {
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0)) {
    await fs.rm(dir, { force: true, recursive: true });
  }
});

describe.skipIf(process.platform !== "linux")(
  "#1779 umbrella workspace watch",
  () => {
    it("watches every nested node_modules/.git directory because the ignore list only covers the root level", async () => {
      const { root, nestedDirCount } = await buildUmbrellaRoot();

      // Capture the options the daemon hands to @parcel/watcher for the
      // workspace-root subscription (the real subscribe still runs).
      const seenOptions: Array<{ dir: string; ignore: string[] | undefined }> =
        [];
      const realSubscribe = parcelWatcher.subscribe.bind(parcelWatcher);
      vi.spyOn(parcelWatcher, "subscribe").mockImplementation(
        async (dir, cb, opts) => {
          seenOptions.push({ dir, ignore: opts?.ignore });
          return realSubscribe(dir, cb, opts);
        },
      );

      const baselineWatches = countInotifyWatches();
      const baselineRss = rssMb();
      let ready!: () => void;
      const readyPromise = new Promise<void>((resolve) => {
        ready = resolve;
      });
      const errors: string[] = [];
      const stop = watchWorkspaceStatus(root, {
        onChange: () => undefined,
        onReady: () => ready(),
        onWatchError: (error) => errors.push(error.message),
      });
      try {
        await readyPromise;
        // Settle the metadata (git-dir) subscriptions too.
        await new Promise((resolve) => setTimeout(resolve, 300));

        const realRoot = fsSync.realpathSync(root);
        const workspaceRootSubscribe = seenOptions.find(
          (o) => o.dir === root || o.dir === realRoot,
        );
        const watches = countInotifyWatches() - baselineWatches;
        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify(
            {
              root,
              workspaceRootIgnore: workspaceRootSubscribe?.ignore,
              nestedDirCount,
              inotifyWatchesAdded: watches,
              rssMbBefore: baselineRss,
              rssMbAfter: rssMb(),
              errors,
            },
            null,
            2,
          ),
        );

        // What the daemon actually passes: the ROOT's own ignores only. The
        // umbrella root has no .gitignore, so the list is just [".git"].
        expect(workspaceRootSubscribe?.ignore).toContain(".git");

        // BUG: the nested node_modules trees (and nested .git dirs) are all
        // watched. With a recursive `**/node_modules`, `**/.git` ignore this
        // would be a handful of watches (root, apps, apps/child-N + git dir).
        // This assertion documents the bug; it FAILS on main because the watch
        // count is >= nestedDirCount.
        expect(watches).toBeLessThan(nestedDirCount);
      } finally {
        await stop();
      }
    });

    it("control: a recursive glob ignore keeps the same tree cheap", async () => {
      const { root, nestedDirCount } = await buildUmbrellaRoot();
      const baseline = countInotifyWatches();
      const sub = await parcelWatcher.subscribe(root, () => undefined, {
        ignore: ["**/.git", "**/node_modules"],
      });
      try {
        const watches = countInotifyWatches() - baseline;
        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify({
            control: true,
            nestedDirCount,
            inotifyWatchesAdded: watches,
          }),
        );
        expect(watches).toBeLessThan(20);
      } finally {
        await sub.unsubscribe();
      }
    });
  },
);
