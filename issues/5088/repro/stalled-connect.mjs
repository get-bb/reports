import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = resolve(process.argv[2] ?? ".");
const port = Number(process.argv[3]);
assert.ok(Number.isInteger(port) && port >= 40000 && port <= 60000);
const load = (relativePath) => import(pathToFileURL(resolve(root, relativePath)).href);
const { redeemMachineCredential } = await load("packages/connect-client/src/redeem-machine.ts");
const { fetchDesktopSession } = await load("packages/connect-client/src/desktop-session.ts");
const { createSessionScheduler } = await load("apps/mobile/src/lib/session/session-scheduler.ts");
const { resolveShellScreenState } = await load("apps/mobile/src/lib/shell/shell-state.ts");
const origin = `http://localhost:${port}`;
const credential = { credential: "local-test-only", handle: "probe", serverUrl: origin };
const profile = { id: "local-profile", mode: "connect", label: "probe", ...credential };
const session = {
  cookie: { name: "local-session", value: "local-test-only", domain: "localhost", expiresAt: Date.now() + 3_600_000 },
};
let mode = "healthy";
let received = 0;
const server = createServer((request, response) => {
  received += 1;
  request.resume();
  if (mode === "stalled") return;
  response.setHeader("content-type", "application/json");
  if (mode === "unavailable") {
    response.writeHead(503).end(JSON.stringify({ error: "unavailable" }));
    return;
  }
  if (request.url === "/api/connect/redeem-machine") {
    response.end(JSON.stringify({ credential: "local-test-only", machineId: "local-machine", serverUrl: `http://probe.localhost:${port}` }));
    return;
  }
  assert.equal(request.url, "/api/connect/desktop-session");
  response.end(JSON.stringify(session));
});
server.listen(port, "127.0.0.1");
await once(server, "listening");
const redeem = (fetchImpl = fetch) => redeemMachineCredential({ apexUrl: origin, code: "local-code", deviceName: "local-probe" }, fetchImpl);
const makeScheduler = (fetchImpl = fetch) => createSessionScheduler({
  cookieStore: { set: async () => undefined },
  sessionCache: { read: async () => null, write: async () => undefined, clear: async () => undefined },
  fetchSession: (input) => fetchDesktopSession(input, fetchImpl),
});
const schedulers = [];
const controllers = [];
const pending = [];
try {
  const healthyRedeem = await redeem();
  assert.equal(healthyRedeem.handle, "probe");
  assert.deepEqual(await fetchDesktopSession(credential), session);
  const healthyScheduler = makeScheduler();
  schedulers.push(healthyScheduler);
  assert.equal((await healthyScheduler.start(profile)).status, "authenticated");
  healthyScheduler.stop();
  console.log("Healthy responses: enrollment succeeds; session scheduler authenticates.");
  mode = "unavailable";
  await assert.rejects(redeem(), { code: "network" });
  const unavailableScheduler = makeScheduler();
  schedulers.push(unavailableScheduler);
  assert.equal((await unavailableScheduler.start(profile)).status, "error");
  unavailableScheduler.stop();
  console.log("HTTP 503 controls: enrollment rejects with network; session scheduler reports error.");
  mode = "stalled";
  const receivedBefore = received;
  let providedSignals = 0;
  const observedFetch = (input, init) => {
    if (init?.signal != null) providedSignals += 1;
    const controller = new AbortController();
    controllers.push(controller);
    return fetch(input, { ...init, signal: controller.signal });
  };
  let enrollmentState = "pending";
  pending.push(redeem(observedFetch).then(() => { enrollmentState = "resolved"; }, () => { enrollmentState = "rejected"; }));
  const stalledScheduler = makeScheduler(observedFetch);
  schedulers.push(stalledScheduler);
  let schedulerSettled = false;
  pending.push(stalledScheduler.start(profile).finally(() => { schedulerSettled = true; }));
  await delay(2_000);
  assert.equal(received - receivedBefore, 2);
  assert.equal(enrollmentState, "pending");
  assert.equal(schedulerSettled, false);
  assert.equal(stalledScheduler.getState().status, "authenticating");
  assert.equal(providedSignals, 0);
  const shell = resolveShellScreenState({ storeReady: true, hasAnyProfile: true, hasProfile: true, requiresSession: true, session: stalledScheduler.getState(), load: { kind: "loading" } });
  assert.deepEqual(shell, { kind: "loading", message: "Signing in" });
  console.log("Stalled HTTP responses: both requests reached the local server; no application abort signal supplied.");
  console.log("At 2000 ms: enrollment=pending; session=authenticating; shell=loading (Signing in).");
  controllers.forEach((controller) => controller.abort());
  await Promise.all(pending);
  assert.equal(enrollmentState, "rejected");
  assert.equal(stalledScheduler.getState().status, "error");
  console.log("Harness cancellation: enrollment rejects; session exits authenticating into error.");
  console.log("PARTIAL ONLY: no Android runtime, TLS, cellular path, or Chrome comparison exercised.");
} finally {
  schedulers.forEach((scheduler) => scheduler.stop());
  controllers.forEach((controller) => controller.abort());
  server.closeAllConnections();
  await new Promise((complete) => server.close(complete));
}
