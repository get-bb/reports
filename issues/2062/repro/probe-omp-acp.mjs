#!/usr/bin/env node
// Probe a real ACP agent (`omp acp`): initialize + session/new, then print the
// raw `model` config option it advertises so we can see the wire shape.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const [cmd, ...args] = process.argv.slice(2);
const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "inherit"] });
const send = (m) => child.stdin.write(JSON.stringify(m) + "\n");
const timer = setTimeout(() => {
  console.error("timed out");
  child.kill();
  process.exit(2);
}, 30000);

createInterface({ input: child.stdout }).on("line", (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  if (msg.id === 1) {
    send({
      jsonrpc: "2.0",
      id: 2,
      method: "session/new",
      params: { cwd: process.cwd(), mcpServers: [] },
    });
  } else if (msg.id === 2) {
    const opts = msg.result?.configOptions ?? [];
    const model = opts.find((o) => o.category === "model" || o.id === "model");
    const options = model?.options ?? [];
    console.log(`config option ids: ${opts.map((o) => o.id).join(", ")}`);
    console.log(`model select options: ${options.length}`);
    console.log("first 3 options raw:");
    console.log(JSON.stringify(options.slice(0, 3), null, 2));
    const byName = new Map();
    for (const o of options) {
      byName.set(o.name, [...(byName.get(o.name) ?? []), o]);
    }
    const dups = [...byName.entries()].filter(([, v]) => v.length > 1);
    console.log(`display names shared by >1 option: ${dups.length}`);
    for (const [name, v] of dups.slice(0, 5)) {
      console.log(`  "${name}" -> ${v.map((o) => o.value).join(" | ")}`);
    }
    clearTimeout(timer);
    child.kill();
    process.exit(0);
  }
});

send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: 1,
    clientInfo: { name: "probe", version: "0" },
    clientCapabilities: {
      fs: { readTextFile: false, writeTextFile: false },
      terminal: false,
    },
  },
});
