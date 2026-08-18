// Mimics cursor-agent's persistent-shell executor: spawn a fresh shell with
// `cwd` set to the *stored* cwd. When that directory has been deleted, Node
// emits `error` (spawn ... ENOENT) — the executor forwards it as a thrown
// error into the tool's async iterator instead of yielding an `exit` event.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(os.tmpdir(), "bb1529-"));
rmSync(dir, { recursive: true, force: true }); // "git worktree remove --force"

const child = spawn("/bin/bash", ["-c", "echo hi"], {
  cwd: dir,
  stdio: ["ignore", "pipe", "pipe", "pipe", "pipe"],
  detached: true,
});
child.on("spawn", () => console.log("event: spawn"));
child.on("error", (err) =>
  console.log(`event: error  -> ${err.code} ${err.syscall} ${err.message}`),
);
child.on("exit", (code, signal) =>
  console.log(`event: exit   -> code=${code} signal=${signal}`),
);
child.on("close", (code, signal) =>
  console.log(`event: close  -> code=${code} signal=${signal}`),
);
