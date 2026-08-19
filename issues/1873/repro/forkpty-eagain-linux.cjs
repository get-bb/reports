// Linux control experiment: make fork() fail (RLIMIT_NPROC below the user's
// current process count) and call node-pty's native fork. On Linux the
// Napi::Error thrown inside PtyFork is caught by pty.node's OWN copy of
// Napi::details::CallbackData<...>::Wrapper (NAPI_CPP_EXCEPTIONS build) and
// surfaces as an ordinary JS exception. Run from apps/host-daemon:
//   node /tmp/bb-reports/issues/1873/repro/forkpty-eagain-linux.cjs
const { execFileSync } = require("node:child_process");
const pty = require("node-pty");
// Load @parcel/watcher too, the same two addons the daemon has in-process.
require("@parcel/watcher");
// Lower the process limit for this pid only (threads already exist; new fork() -> EAGAIN).
execFileSync("prlimit", ["--pid", String(process.pid), "--nproc=1:1"]);
try {
  const p = pty.spawn("/bin/sh", ["-c", "echo hi"], { cols: 80, rows: 24, cwd: "/tmp", env: process.env });
  console.log("unexpected: spawned pid", p.pid);
} catch (err) {
  console.log("caught JS error:", err && err.message);
}
console.log("process still alive, exiting normally");
