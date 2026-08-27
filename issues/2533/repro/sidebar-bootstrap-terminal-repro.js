const { spawnSync } = require("node:child_process");

const appUrl = process.env.APP_URL;
if (!appUrl) {
  console.error(
    "APP_URL is required. Example: APP_URL=http://localhost:12207 node sidebar-bootstrap-terminal-repro.js",
  );
  process.exit(2);
}

try {
  new URL(appUrl);
} catch {
  console.error(`APP_URL is not a valid URL: ${appUrl}`);
  process.exit(2);
}

const browserName = process.env.DOOBIE_BROWSER ?? "issue-2533-repro";
const outageMs = 8_000;
const browserScript = `
const APP_URL = ${JSON.stringify(appUrl)};
const OUTAGE_MS = ${outageMs};
const page = await browser.getPage("issue-2533-repro");
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 15000 });
await page.waitForFunction(
  () => document.body.innerText.includes("New thread"),
  { timeout: 10000 },
);
await page.evaluate(() => localStorage.clear());
await page.setCacheEnabled(false);
await page.setRequestInterception(true);

const startedAt = Date.now();
const requestLog = [];
const socketLog = [];
const socketUrlsById = new Map();
const queryStatusLog = [{ elapsedMs: 0, status: "loading" }];
const cdp = await page.createCDPSession();
await cdp.send("Network.enable");
cdp.on("Network.webSocketCreated", ({ requestId, url }) => {
  socketUrlsById.set(requestId, url);
  if (new URL(url).pathname !== "/ws") return;
  socketLog.push({ elapsedMs: Date.now() - startedAt, event: "created", requestId, url });
});
cdp.on("Network.webSocketHandshakeResponseReceived", ({ requestId, response }) => {
  const url = socketUrlsById.get(requestId) ?? response.url;
  if (!url || new URL(url).pathname !== "/ws") return;
  socketLog.push({
    elapsedMs: Date.now() - startedAt,
    event: "connected",
    requestId,
    status: response.status,
    url,
  });
});

page.on("request", async (request) => {
  const requestUrl = new URL(request.url());
  if (requestUrl.pathname === "/api/v1/sidebar-bootstrap") {
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs < OUTAGE_MS) {
      requestLog.push({ action: "fail", elapsedMs });
      await request.abort("connectionrefused").catch(() => {});
      return;
    }
    requestLog.push({ action: "continue", elapsedMs });
  }
  await request.continue().catch(() => {});
});

await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 15000 });
let errorObserved = true;
try {
  await page.waitForFunction(
    () => document.body.innerText.includes("Failed to load projects."),
    { timeout: 10000 },
  );
} catch {
  errorObserved = false;
}
const failedAtMs = Date.now() - startedAt;
queryStatusLog.push({
  elapsedMs: failedAtMs,
  status: errorObserved ? "error" : "not-observed",
  evidence: errorObserved ? "Failed to load projects." : "error text did not appear",
});

await new Promise((resolve) =>
  setTimeout(resolve, Math.max(0, 9000 - (Date.now() - startedAt))),
);
await page.evaluate(() => {
  window.dispatchEvent(new Event("focus"));
  window.dispatchEvent(new Event("pageshow"));
  window.dispatchEvent(new Event("online"));
  document.dispatchEvent(new Event("visibilitychange"));
});
const lifecycleEventsAtMs = Date.now() - startedAt;
await new Promise((resolve) => setTimeout(resolve, 2000));

const finalAtMs = Date.now() - startedAt;
const finalText = await page.$eval("body", (body) => body.innerText);
const finalHasError = finalText.includes("Failed to load projects.");
queryStatusLog.push({
  elapsedMs: finalAtMs,
  status: finalHasError ? "error" : "success",
  evidence: finalHasError ? "Failed to load projects." : "error cleared",
});
const socketConnectedAtMs = socketLog.find(
  (entry) => entry.event === "connected",
)?.elapsedMs ?? null;
({
  appUrl: APP_URL,
  outageMs: OUTAGE_MS,
  failedAtMs,
  finalAtMs,
  finalHasError,
  lifecycleEventsAtMs,
  sidebarRequestCount: requestLog.length,
  socketConnectedAtMs,
  socketConnectedBeforeQueryError:
    socketConnectedAtMs !== null && socketConnectedAtMs < failedAtMs,
  requestLog,
  socketLog,
  queryStatusLog,
  textExcerpt: finalText.split("\\n").filter(Boolean).slice(-20),
});
`;

const result = spawnSync(
  "doobie",
  ["-b", browserName, "--headless", "-t", "35"],
  { encoding: "utf8", input: browserScript },
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
