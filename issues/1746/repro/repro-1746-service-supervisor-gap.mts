// Issue #1746 standalone repro (run with: node --import tsx apps/server/test/repro-1746-service-supervisor-gap.mts)
//
// Models exactly what the server does:
//   1. installSafeProcessDiagnostics() -> registers ONLY `uncaughtExceptionMonitor`
//   2. runService() supervises a plugin background service via its start() promise
// and what a buggy plugin does: an EventEmitter (ImapFlow) with no 'error'
// listener emits 'error' from a timer callback.
//
// Expected if the supervisor were sufficient: "supervisor saw crash" is printed
// and the process keeps running. Actual: the supervisor never fires, a
// process-repro-uncaughtException-*.json dump is written, and node exits 1.
import { EventEmitter } from "node:events";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installSafeProcessDiagnostics } from "@bb/process-utils";

const logsDir = mkdtempSync(join(tmpdir(), "bb-1746-"));
installSafeProcessDiagnostics({ logsDir, processName: "repro" });

let supervisorSawCrash = false;
function runService(start: (signal: AbortSignal) => Promise<void>): void {
  const controller = new AbortController();
  const current = (async () => {
    await start(controller.signal);
  })();
  current.then(
    () => console.log("supervisor: service stopped cleanly"),
    (error) => {
      supervisorSawCrash = true;
      console.log("supervisor saw crash:", String(error));
    },
  );
}

runService(async (signal) => {
  const client = new EventEmitter(); // ImapFlow without .on("error")
  setTimeout(() => client.emit("error", new Error("Socket timeout")), 50);
  await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve()));
});

process.on("exit", (code) => {
  console.log(`exit code=${code} supervisorSawCrash=${supervisorSawCrash}`);
  console.log("dumps:", readdirSync(logsDir));
});
