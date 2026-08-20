// Probe: send an ACP `initialize` to an ACP agent over stdio and print the
// agentCapabilities it advertises. This is the exact request bb's ACP bridge
// sends (plugins/provider-acp/src/bridge/bridge.ts, `method: "initialize"`).
// Usage: node probe-cursor-acp-initialize.mjs [command] [args...]
//   default: cursor-agent acp
import { spawn } from "node:child_process";
const [cmd = "cursor-agent", ...args] = process.argv.slice(2);
const child = spawn(cmd, args.length ? args : ["acp"], {
  stdio: ["pipe", "pipe", "inherit"],
});
let buf = "";
child.stdout.on("data", (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      console.log("non-json:", line);
      continue;
    }
    if (msg.id === 1) {
      console.log(JSON.stringify(msg.result, null, 2));
      const caps = msg.result?.agentCapabilities ?? {};
      console.log(
        "sessionCapabilities.fork advertised:",
        caps.sessionCapabilities?.fork != null,
      );
      child.kill();
      process.exit(0);
    }
  }
});
child.stdin.write(
  JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: 1,
      clientInfo: { name: "bb", version: "1.0.0" },
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: false,
      },
    },
  }) + "\n",
);
setTimeout(() => {
  console.log("timeout");
  child.kill();
  process.exit(2);
}, 30000);
