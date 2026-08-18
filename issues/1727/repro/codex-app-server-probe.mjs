// Probe: what does `codex app-server` emit on thread/resume and thread/fork,
// and does thread/tokenUsage/updated arrive before turn/started with a
// turnId that the client has never seen?
//
// Usage: node codex-app-server-probe.mjs <cwd>
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const cwd = process.argv[2] ?? process.cwd();

function child(label) {
  const proc = spawn("codex", ["app-server"], { cwd, stdio: ["pipe", "pipe", "pipe"] });
  let nextId = 1;
  const pending = new Map();
  const notifications = [];
  const rl = createInterface({ input: proc.stdout });
  rl.on("line", (line) => {
    let msg;
    try { msg = JSON.parse(line); } catch { return; }
    if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
      const p = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) p?.reject(new Error(JSON.stringify(msg.error))); else p?.resolve(msg.result);
      return;
    }
    if (msg.method && msg.id !== undefined) {
      console.log(`[${label}] <-REQ ${msg.method}`);
      return;
    }
    if (msg.method) {
      const p = msg.params ?? {};
      const summary = { turnId: p.turnId, threadId: p.threadId };
      if (msg.method === "thread/tokenUsage/updated") {
        summary.total = p.tokenUsage?.total?.totalTokens; summary.last = p.tokenUsage?.last?.totalTokens;
      }
      if (msg.method === "turn/started" || msg.method === "turn/completed") summary.turn = p.turn?.id;
      console.log(`[${label}] <-NOTIF ${msg.method} ${JSON.stringify(summary)}`);
      notifications.push(msg);
    }
  });
  proc.stderr.on("data", () => {});
  const request = (method, params) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    console.log(`[${label}] ->REQ ${method} ${JSON.stringify(params ?? {})}`);
    proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
  return { proc, request, notifications };
}

const init = { clientInfo: { name: "bb-probe", version: "1.0.0", title: null }, capabilities: { experimentalApi: true } };
const shared = { cwd, approvalPolicy: "never", sandbox: "read-only" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function waitForTurnCompleted(c) {
  return new Promise((resolve) => {
    const iv = setInterval(() => {
      if (c.notifications.some((n) => n.method === "turn/completed")) { clearInterval(iv); resolve(); }
    }, 100);
  });
}

// 1. Fresh thread + one tiny turn.
const a = child("A:start");
await a.request("initialize", init);
const started = await a.request("thread/start", { ...shared, ephemeral: false, experimentalRawEvents: true });
const threadId = started.thread.id;
console.log(`[A] threadId=${threadId}`);
await a.request("turn/start", { threadId, input: [{ type: "text", text: "Reply only with ok." }] });
await waitForTurnCompleted(a);
await sleep(500);
a.proc.kill();

// 2. Resume in a new process (what bb does after archive->unarchive or idle release).
const b = child("B:resume");
await b.request("initialize", init);
console.log("[B] --- sending thread/resume ---");
await b.request("thread/resume", { threadId, ...shared });
await sleep(1500);
console.log("[B] --- sending turn/start on resumed thread ---");
await b.request("turn/start", { threadId, input: [{ type: "text", text: "Reply only with ok." }] });
await waitForTurnCompleted(b);
await sleep(500);
b.proc.kill();

// 3. Fork in a new process (what bb does for a native fork).
const c = child("C:fork");
await c.request("initialize", init);
console.log("[C] --- sending thread/fork ---");
const forked = await c.request("thread/fork", { threadId, ...shared });
console.log(`[C] forked threadId=${forked.thread.id}`);
await sleep(1500);
console.log("[C] --- sending turn/start on forked thread ---");
await c.request("turn/start", { threadId: forked.thread.id, input: [{ type: "text", text: "Reply only with ok." }] });
await waitForTurnCompleted(c);
await sleep(500);
c.proc.kill();
process.exit(0);
