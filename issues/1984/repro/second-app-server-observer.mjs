#!/usr/bin/env node
// Repro for get-bb/bb#1984.
//
// Plays the role of Codex Desktop: a SEPARATE `codex app-server` process
// (separate from the one bb spawns) that lists unarchived threads and then
// listens for `thread/archived` notifications.  While it listens, archive the
// thread from bb (`bb thread archive <id>`).  Expected if Codex Desktop were
// told: a `thread/archived` notification.  Actual: nothing arrives, because
// app-server notifications are per-process; only a re-list shows the thread
// gone.
//
// Usage: CODEX_HOME=/tmp/bb1984-codex-home node second-app-server-observer.mjs <codexThreadId> [listenSeconds]
import { spawn } from "node:child_process";
import readline from "node:readline";

const [threadId, listenSecondsArg] = process.argv.slice(2);
if (!threadId) {
  console.error("usage: second-app-server-observer.mjs <codexThreadId> [listenSeconds]");
  process.exit(2);
}
const listenMs = Number(listenSecondsArg ?? "60") * 1000;

const child = spawn("codex", ["app-server"], { stdio: ["pipe", "pipe", "inherit"] });
const rl = readline.createInterface({ input: child.stdout });
let nextId = 1;
const pending = new Map();
const notifications = [];

rl.on("line", (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.id !== undefined && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
    return;
  }
  if (msg.method) {
    notifications.push(msg);
    const stamp = new Date().toISOString();
    console.log(`[${stamp}] notification ${msg.method} ${JSON.stringify(msg.params ?? {}).slice(0, 200)}`);
  }
});

function request(method, params) {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify({ id, method, params }) + "\n");
  });
}

function listed(result) {
  return (result?.data ?? []).map((t) => t.id);
}

const init = await request("initialize", {
  clientInfo: { name: "bb-1984-observer", version: "0.0.0", title: null },
  capabilities: { experimentalApi: true },
});
console.log("initialize ->", JSON.stringify(init.result ?? init.error).slice(0, 200));
child.stdin.write(JSON.stringify({ method: "initialized" }) + "\n");

const before = await request("thread/list", { archived: false, limit: 100 });
const beforeIds = listed(before.result);
console.log(`thread/list archived:false BEFORE -> ${beforeIds.length} threads; contains ${threadId}: ${beforeIds.includes(threadId)}`);

console.log(`listening ${listenMs / 1000}s for notifications... archive the thread from bb now`);
await new Promise((r) => setTimeout(r, listenMs));

const archivedNotifs = notifications.filter((n) => n.method === "thread/archived");
console.log(`thread/archived notifications received by THIS app-server: ${archivedNotifs.length}`);
console.log(`all notification methods received: ${JSON.stringify([...new Set(notifications.map((n) => n.method))])}`);

const after = await request("thread/list", { archived: false, limit: 100 });
const afterIds = listed(after.result);
console.log(`thread/list archived:false AFTER -> ${afterIds.length} threads; contains ${threadId}: ${afterIds.includes(threadId)}`);
const afterArchived = await request("thread/list", { archived: true, limit: 100 });
console.log(`thread/list archived:true AFTER contains ${threadId}: ${listed(afterArchived.result).includes(threadId)}`);

child.kill();
process.exit(0);
