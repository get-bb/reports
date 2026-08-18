// dev-browser script (Playwright page API in a QuickJS sandbox).
// Usage: see 1303-run-count.sh (substitutes __APP__/__PROJECT__/__THREAD__/__THREAD_TITLE__).
// Loads the app at mobile width (390x844) on the project home page, waits for the shell to settle,
// then taps the thread in the sidebar (client-side navigation, exactly what "switching threads" does)
// and records every /api/ request until the network has been idle for 3 s. Prints the list with
// per-request latency, then goes back and repeats once with warm react-query caches.
const APP = "__APP__";
const PROJECT = "__PROJECT__";
const THREAD = "__THREAD__";
const THREAD_TITLE = "__THREAD_TITLE__";

const page = await browser.newPage();
await page.setViewportSize({ width: 390, height: 844 });
const log = [];
let t0 = 0;
page.on("request", (req) => {
  const u = req.url();
  if (!u.includes("/api/v1/")) return;
  log.push({ t: Date.now() - t0, method: req.method(), url: u.replace(APP, ""), start: Date.now(), req });
});
page.on("response", (res) => {
  const entry = log.find((e) => e.req === res.request());
  if (entry) { entry.end = Date.now(); entry.ms = entry.end - entry.start; entry.status = res.status(); }
});

async function settle(idleMs) {
  let last = log.length;
  let quietSince = Date.now();
  while (Date.now() - quietSince < idleMs) {
    await new Promise((r) => setTimeout(r, 200));
    if (log.length !== last) { last = log.length; quietSince = Date.now(); }
  }
}

function report(label) {
  const rows = log.map((e) => `+${String(e.t).padStart(5)}ms  ${String(e.ms ?? "?").padStart(5)}ms  ${e.status ?? "?"}  ${e.method} ${e.url}`);
  const lastEnd = Math.max(0, ...log.map((e) => (e.end ?? 0) - t0));
  const distinct = new Set(log.map((e) => e.method + " " + e.url));
  console.log(`\n=== ${label}: ${log.length} /api/v1/ requests (${distinct.size} distinct URLs; dev StrictMode double-fires); last response at +${lastEnd}ms ===`);
  console.log("start     latency  status");
  console.log(rows.join("\n"));
}

// 1) warm the shell on the project page (NOT the thread) and open the sidebar drawer
t0 = Date.now();
await page.goto(APP + "/projects/" + PROJECT, { waitUntil: "load" });
await settle(4000);
console.log("shell (project page, mobile) requests: " + log.length);
await page.getByRole("button", { name: "Toggle Sidebar" }).first().click({ timeout: 5000 }).catch((e) => console.log("toggle sidebar click failed: " + e.message));
await new Promise((r) => setTimeout(r, 800));
await saveScreenshot(await page.screenshot(), "1303-before.png");

for (const round of [1, 2]) {
  log.length = 0;
  t0 = Date.now();
  await page.getByRole("link", { name: "Open " + THREAD_TITLE }).first().click({ timeout: 5000 });
  await settle(3000);
  report(`round ${round}: tap thread "${THREAD_TITLE}" (${THREAD}) in sidebar`);
  await saveScreenshot(await page.screenshot(), `1303-thread-round${round}.png`);
  if (round === 1) {
    // go back to the project page and reopen the sidebar for the warm round
    await page.goBack();
    await settle(2000);
    await page.getByRole("button", { name: "Toggle Sidebar" }).first().click({ timeout: 5000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 800));
  }
}
