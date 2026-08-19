import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { afterAll, describe, expect, it } from "vitest";

// Repro for get-bb/bb#1873.
//
// The host daemon is supposed to keep the native @parcel/watcher addon OUT of
// the parent process (it runs parcel in a forked child, see
// start-host-daemon.ts). packages/host-watcher reaches the addon through
// `await import("./real-parcel-watcher.js")`, but when esbuild bundles the
// daemon (format: "esm", bundle: true, @parcel/watcher external) it inlines that
// internal module and HOISTS its `import parcelWatcher from "@parcel/watcher"`
// to a static top-level import of the bundle. watcher.node therefore loads at
// daemon startup, before pty.node.
//
// On macOS, dyld coalesces weak template instantiations across images, so
// node-pty's call to Napi::details::CallbackData<...>::Wrapper binds to
// watcher.node's copy, which is compiled with NAPI_DISABLE_CPP_EXCEPTIONS and
// has no try/catch. A failing PtyFork then throws Napi::Error into a frame that
// cannot catch it -> std::terminate -> SIGABRT (the crash report in #1873).
//
// This test bundles the same entry the daemon bundle uses and asserts the
// output has no static import of @parcel/watcher. It FAILS on d81fee6f.

const here = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(here, "..", "..", "..");
const hostWatcherEntry = resolve(
  workspaceRoot,
  "packages",
  "host-watcher",
  "src",
  "index.ts",
);

const outDir = await mkdtemp(join(tmpdir(), "bb-1873-bundle-"));

afterAll(async () => {
  await rm(outDir, { recursive: true, force: true });
});

describe("daemon bundle keeps @parcel/watcher out of the parent process", () => {
  it("does not hoist a static import of @parcel/watcher", async () => {
    const outfile = join(outDir, "host-watcher-bundle.mjs");
    await build({
      bundle: true,
      conditions: ["source"],
      entryPoints: [hostWatcherEntry],
      external: ["@parcel/watcher", "@parcel/watcher-*"],
      format: "esm",
      legalComments: "none",
      minify: false,
      outfile,
      platform: "node",
      sourcemap: false,
      target: "node22",
    });
    const bundle = await readFile(outfile, "utf8");
    const staticImports = bundle.match(
      /^import\s+[^;]*?\s+from\s*["']@parcel\/watcher["'];?$/gmu,
    );
    expect(
      staticImports,
      `static top-level import(s) of @parcel/watcher found in the bundle; ` +
        `watcher.node would load at daemon startup:\n${(staticImports ?? []).join("\n")}`,
    ).toBeNull();
    // The lazy path must stay a real dynamic `import("@parcel/watcher")`.
    expect(bundle).toMatch(/import\(\s*["']@parcel\/watcher["']\s*\)/u);
  });
});
