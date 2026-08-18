// dev-browser script (path C): load the thread page, optionally persist the
// strip once (Ctrl+D = Diff panel, so the server tab list is at revision >= 1),
// then poll the right-panel tab strip every 150 ms while an external
// `bb thread open <thread> README.md` runs (see run-thread-open.sh).
// Records the strip labels over time, the toast text, all /tabs traffic
// (with the revision returned by each GET), then reloads and prints the strip.
//
// Run with a longer timeout than dev-browser's 30 s default:
//   dev-browser --browser bb1773 --headless --timeout 120 run browser-reload-and-watch-fast.js
//
// EDIT THESE for your instance (App URL from `scripts/bb-dev-app current`):
const APP_URL = "http://localhost:17786";
const PROJECT_ID = "proj_w6z9wi4egw";
const THREAD_ID = "thr_eic8xpsxa2";
const PRESS_DIFF_FIRST = false; // false = leave a fresh thread at revision 0

const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });
const reqs = [];
page.on("response", async (r) => {
  if (r.url().includes("/tabs")) {
    let extra = "";
    if (r.request().method() === "GET") {
      try { extra = " body=" + JSON.stringify(await r.json()); } catch {}
    }
    reqs.push(Date.now() + " " + r.request().method() + " " + r.url() + " => " + r.status() + extra);
  }
});
await page.goto(`${APP_URL}/projects/${PROJECT_ID}/threads/${THREAD_ID}`);
await page.waitForTimeout(6000);
if (PRESS_DIFF_FIRST) {
  await page.locator('button[aria-label="Show diff panel (Ctrl + D)"]').click();
  await page.waitForTimeout(3000);
  const strip0 = await page.locator("[data-tab-pill-close]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  console.log("PRECONDITION strip after Ctrl+D:", JSON.stringify(strip0));
}
await writeFile("1773-ready", "ready"); // signal for run-thread-open.sh
const timeline = [];
let toastText = "";
const t0 = Date.now();
for (let i = 0; i < 100; i++) {
  await page.waitForTimeout(150);
  const strip = await page.locator("[data-tab-pill-close]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  const entry = (Date.now() - t0) + "ms strip=" + JSON.stringify(strip.filter(Boolean));
  if (timeline[timeline.length - 1]?.split(" ").slice(1).join(" ") !== entry.split(" ").slice(1).join(" ")) {
    timeline.push(entry);
  }
  const t = await page.locator("[data-sonner-toast]").allInnerTexts();
  if (t.length > 0 && t.join("").trim() !== "" && toastText === "") {
    toastText = t.join("\n---\n");
    await saveScreenshot(await page.screenshot(), "1773-toast-C.png");
  }
}
console.log("TIMELINE:\n" + timeline.join("\n"));
console.log("TOAST:", JSON.stringify(toastText));
console.log("REQS:\n" + reqs.join("\n"));
await saveScreenshot(await page.screenshot(), "1773-final-C.png");
await page.reload();
await page.waitForTimeout(6000);
const stripAfterReload = await page.locator("[data-tab-pill-close]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
console.log("STRIP AFTER RELOAD:", JSON.stringify(stripAfterReload));
console.log("REQS AFTER RELOAD:\n" + reqs.slice(-3).join("\n"));
await saveScreenshot(await page.screenshot(), "1773-after-reload-C.png");
