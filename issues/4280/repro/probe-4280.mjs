import assert from "node:assert/strict";
import { createServer } from "node:http";
import { Socket } from "node:net";
import { createServerClient } from "./apps/host-daemon/src/server-client.ts";

console.log(JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch, undici: process.versions.undici, socketTosAvailable: typeof Socket.prototype.setTypeOfService === "function" }));
for (const host of ["127.0.0.1", "::1"]) {
  let mode = "ok";
  let requests = 0;
  const server = createServer((req, res) => {
    requests++;
    req.resume();
    if (mode === "reset") { req.socket.destroy(); return; }
    res.setHeader("content-type", "application/json");
    res.setHeader("connection", "close");
    res.end(JSON.stringify({ acceptedEvents: [], rejectedEvents: [] }));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, resolve);
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  const client = createServerClient({
    serverUrl: `http://${host === "::1" ? "[::1]" : host}:${address.port}`,
    hostKey: "local-probe-only",
    getSessionId: () => "local-probe-session",
    logger: { debug() {}, error() {}, info() {}, warn() {} },
  });
  try {
    for (let i = 0; i < 100; i++) {
      assert.deepEqual(await client.postEvents([]), { acceptedEvents: [], rejectedEvents: [] });
    }
    mode = "reset";
    for (let i = 0; i < 10; i++) await assert.rejects(client.postEvents([]), TypeError);
    mode = "ok";
    await client.postEvents([]);
    console.log(`${host}: 100 POSTs passed; 10 socket resets rejected; recovery POST passed; requests=${requests}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}
console.log("No uncaught exception observed; reported platform-specific crash NOT REPRODUCED.");
