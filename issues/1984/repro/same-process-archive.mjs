#!/usr/bin/env node
// Control for get-bb/bb#1984: when the SAME app-server process performs
// thread/unarchive + thread/archive, it DOES receive thread/unarchived and
// thread/archived notifications. This is the path Codex Desktop relies on
// (its own app-server child -> handleNotification -> applyAuthoritativeRemoval).
// Usage: CODEX_HOME=... node same-process-archive.mjs <codexThreadId>
import { spawn } from "node:child_process";
import readline from "node:readline";

const [threadId] = process.argv.slice(2);
const child = spawn("codex", ["app-server"], { stdio: ["pipe", "pipe", "inherit"] });
const rl = readline.createInterface({ input: child.stdout });
let nextId = 1;
const pending = new Map();
rl.on("line", (line) => {
  let msg; try { msg = JSON.parse(line); } catch { return; }
  if (msg.id !== undefined && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
  if (msg.method) console.log(`notification ${msg.method} ${JSON.stringify(msg.params ?? {}).slice(0, 160)}`);
});
const request = (method, params) => new Promise((resolve) => {
  const id = nextId++; pending.set(id, resolve);
  child.stdin.write(JSON.stringify({ id, method, params }) + "\n");
});
await request("initialize", { clientInfo: { name: "bb-1984-control", version: "0.0.0", title: null }, capabilities: { experimentalApi: true } });
child.stdin.write(JSON.stringify({ method: "initialized" }) + "\n");
console.log("thread/unarchive ->", JSON.stringify((await request("thread/unarchive", { threadId })).result ?? "error"));
await new Promise((r) => setTimeout(r, 1500));
console.log("thread/archive ->", JSON.stringify((await request("thread/archive", { threadId })).result ?? "error"));
await new Promise((r) => setTimeout(r, 1500));
child.kill(); process.exit(0);
