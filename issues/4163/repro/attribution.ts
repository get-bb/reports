import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";
import { runEventLoopWork, runEventLoopWorkSync, resetEventLoopWorkForTests, takeEventLoopWorkWindowSnapshot } from "./apps/server/src/services/system/event-loop-work.ts";
import { startEventLoopStallMonitor } from "./apps/server/src/services/system/event-loop-stall-monitor.ts";

function block() {
  const until = performance.now() + 650;
  while (performance.now() < until) {}
}

let failures = 0;
for (const mode of ["sync", "async-initial", "async-continuation", "await-only"]) {
  resetEventLoopWorkForTests();
  const records: Record<string, unknown>[] = [];
  const monitor = startEventLoopStallMonitor({ logger: { info: (fields) => { records.push(fields); } } });
  await delay(50);
  const label = `plugin:probe ${mode}`;
  if (mode === "sync") runEventLoopWorkSync(label, block);
  if (mode === "async-initial") await runEventLoopWork(label, async () => { block(); });
  if (mode === "async-continuation") await runEventLoopWork(label, async () => { await delay(10); block(); });
  if (mode === "await-only") await runEventLoopWork(label, () => delay(650));
  await delay(5100);
  monitor.stop();
  const record = records[0];
  console.log(JSON.stringify({ mode, records }));
  try {
    if (mode === "await-only") {
      assert.equal(records.length, 0);
      assert.equal(takeEventLoopWorkWindowSnapshot().slowestWork, null);
    } else {
      assert.ok(record);
      assert.equal(record.slowestWork, label);
    }
    console.log(`PASS ${mode}`);
  } catch (error) {
    failures++;
    console.log(`FAIL ${mode}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
console.log(`Attribution failures: ${failures}`);
process.exitCode = failures ? 1 : 0;
