// Node + Playwright (no sandbox). Opens the bb web app at iPhone width, taps a thread in the sidebar,
// and records every /api/v1/ request with Chrome network emulation (RTT + bandwidth) applied
// via CDP for the thread-open step only. Prints the waterfall and time-to-content.
//
// Usage:
//   PLAYWRIGHT_DIR=/path/to/node_modules/playwright APP=http://localhost:APPPORT PROJECT=proj_x THREAD=thr_y \
//     THREAD_TITLE="1303 target" LATENCY_MS=300 [SCREENSHOT=/abs/path.png] node 1303-waterfall.mjs
// LATENCY_MS=0 disables emulation. PLAYWRIGHT_DIR defaults to the copy bundled with the global dev-browser CLI.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pwDir =
  process.env.PLAYWRIGHT_DIR ??
  `${process.env.HOME}/.nvm/versions/node/v24.18.0/lib/node_modules/dev-browser/node_modules/playwright`;
const { chromium } = require(pwDir);

const APP = process.env.APP;
const PROJECT = process.env.PROJECT;
const THREAD = process.env.THREAD;
const THREAD_TITLE = process.env.THREAD_TITLE;
const LATENCY_MS = Number(process.env.LATENCY_MS ?? "0");
const SCREENSHOT = process.env.SCREENSHOT;
if (!APP || !PROJECT || !THREAD || !THREAD_TITLE) throw new Error("APP, PROJECT, THREAD, THREAD_TITLE required");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await context.newPage();
const log = [];
let t0 = Date.now();
page.on("request", (req) => {
  const u = req.url();
  if (!u.includes("/api/v1/")) return;
  log.push({ t: Date.now() - t0, method: req.method(), url: u.replace(APP, ""), start: Date.now(), req });
});
page.on("response", (res) => {
  const e = log.find((x) => x.req === res.request());
  if (e) { e.end = Date.now(); e.ms = e.end - e.start; e.status = res.status(); }
});
page.on("requestfailed", (req) => {
  const e = log.find((x) => x.req === req);
  if (e) { e.end = Date.now(); e.ms = e.end - e.start; e.status = "aborted"; }
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function settle(idleMs) {
  let last = log.length; let quiet = Date.now();
  while (Date.now() - quiet < idleMs) { await sleep(200); if (log.length !== last) { last = log.length; quiet = Date.now(); } }
}

await page.goto(`${APP}/projects/${PROJECT}`, { waitUntil: "load" });
await settle(4000);
await page.getByRole("button", { name: "Toggle Sidebar" }).first().click({ timeout: 5000 }).catch(() => {});
await sleep(800);

const cdp = await context.newCDPSession(page);
await cdp.send("Network.enable");
if (LATENCY_MS > 0) {
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false, latency: LATENCY_MS,
    downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8,
  });
}
console.log(`emulation: ${LATENCY_MS > 0 ? `latency=${LATENCY_MS}ms down=1.6Mbps up=750kbps` : "none"}; viewport 390x844 mobile`);

log.length = 0; t0 = Date.now();
await page.getByRole("link", { name: `Open ${THREAD_TITLE}` }).first().click({ timeout: 5000 });
let contentAt = null;
try { await page.getByText("Reply only with ok.", { exact: true }).first().waitFor({ timeout: 90000 }); contentAt = Date.now() - t0; } catch {}
await settle(6000);
const lastEnd = Math.max(0, ...log.map((e) => (e.end ?? 0) - t0));
const distinct = new Set(log.map((e) => `${e.method} ${e.url}`));
const done = log.filter((e) => e.status !== "aborted" && e.status !== undefined);
console.log(`\n=== thread open: ${log.length} /api/v1/ requests fired (${distinct.size} distinct URLs; ${done.length} completed, rest aborted by dev StrictMode) ===`);
console.log(`first timeline text visible at +${contentAt}ms; last response at +${lastEnd}ms`);
console.log("start     latency  status");
console.log(log.map((e) => `+${String(e.t).padStart(5)}ms  ${String(e.ms ?? "?").padStart(5)}ms  ${String(e.status ?? "?").padStart(7)}  ${e.method} ${e.url}`).join("\n"));
if (SCREENSHOT) await page.screenshot({ path: SCREENSHOT });
await browser.close();
