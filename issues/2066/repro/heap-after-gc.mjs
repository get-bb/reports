// Measures the V8 heap of a running node process after a forced full GC.
// Usage: node heap-after-gc.mjs <pid> [label]
// Sends SIGUSR1 (activates the inspector on 127.0.0.1:9229), connects over
// the DevTools protocol, runs HeapProfiler.collectGarbage, then reads
// Runtime.getHeapUsage. Prints JSON {label, usedMB, totalMB}.
import { execSync } from "node:child_process";

const pid = Number(process.argv[2]);
const label = process.argv[3] ?? "";
process.kill(pid, "SIGUSR1");
let target;
for (let i = 0; i < 50; i++) {
  try {
    const list = JSON.parse(
      execSync("curl -s http://127.0.0.1:9229/json/list").toString(),
    );
    target = list[0]?.webSocketDebuggerUrl;
    if (target) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 100));
}
if (!target) throw new Error("inspector did not come up on 9229");
const ws = new WebSocket(target);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
const call = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await call("HeapProfiler.enable");
await call("HeapProfiler.collectGarbage");
await call("HeapProfiler.collectGarbage");
const { result } = await call("Runtime.getHeapUsage");
console.log(JSON.stringify({ label, usedMB: +(result.usedSize / 1048576).toFixed(1), totalMB: +(result.totalSize / 1048576).toFixed(1) }));
ws.close();
