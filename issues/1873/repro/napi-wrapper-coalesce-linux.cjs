// Linux analog of what dyld does BY DEFAULT on macOS.
//
// On macOS, dyld coalesces weak definitions (C++ template instantiations such
// as Napi::details::CallbackData<...>::Wrapper) across every loaded image, even
// RTLD_LOCAL ones: the first image that defines the symbol wins. On Linux the
// default RTLD_LOCAL keeps each addon's copy private, so to observe the same
// binding we load @parcel/watcher's watcher.node with RTLD_GLOBAL first. pty.node
// references the Wrapper through the GOT (R_X86_64_GLOB_DAT), so it then binds
// to watcher.node's copy, which was compiled with NAPI_DISABLE_CPP_EXCEPTIONS
// and has NO try/catch around the callback.
//
// Usage (from apps/host-daemon so `require` resolves the workspace deps; no
// NODE_PATH needed -- the platform package is resolved relative to
// @parcel/watcher because pnpm does not hoist it):
//   node napi-wrapper-coalesce-linux.cjs            # watcher first, RTLD_GLOBAL  -> terminate (SIGSEGV on Linux, SIGABRT on macOS)
//   node napi-wrapper-coalesce-linux.cjs --local    # default RTLD_LOCAL          -> catchable JS error
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const { createRequire } = require("node:module");

const useGlobal = !process.argv.includes("--local");
// @parcel/watcher-<platform>-<arch>-glibc is an optional dependency of
// @parcel/watcher and is NOT hoisted by pnpm, so resolve it from @parcel/watcher's
// own location instead of from this script.
const parcelRequire = createRequire(require.resolve("@parcel/watcher"));
const watcherPath = parcelRequire.resolve(
  `@parcel/watcher-${process.platform}-${process.arch}-glibc/watcher.node`,
);
const m = { exports: {} };
process.dlopen(
  m,
  watcherPath,
  useGlobal
    ? os.constants.dlopen.RTLD_NOW | os.constants.dlopen.RTLD_GLOBAL
    : os.constants.dlopen.RTLD_NOW,
);
console.log(`loaded watcher.node ${useGlobal ? "RTLD_GLOBAL" : "RTLD_LOCAL"}: ${watcherPath}`);

const pty = require("node-pty");
console.log("loaded node-pty", require.resolve("node-pty"));

// Make openpty()/forkpty() fail with EMFILE for this pid only: clamp
// RLIMIT_NOFILE to the number of descriptors already open, so PtyFork reaches
// `throw Napi::Error::New(env, "forkpty(3) failed.")`.
const openFds = require("node:fs").readdirSync("/proc/self/fd").length;
execFileSync("prlimit", ["--pid", String(process.pid), `--nofile=${openFds}:${openFds}`]);

try {
  const p = pty.spawn("/bin/sh", ["-c", "echo hi"], {
    cols: 80,
    rows: 24,
    cwd: "/tmp",
    env: process.env,
  });
  console.log("unexpected: spawned pid", p.pid);
} catch (err) {
  console.log("caught JS error:", err && err.message);
}
console.log("process still alive, exiting normally");
