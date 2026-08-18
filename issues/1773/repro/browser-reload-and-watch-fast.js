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
// Configure for your instance by writing ~/.dev-browser/tmp/1773-config.json:
//   {"appUrl":"http://localhost:<app port>","projectId":"proj_x","threadId":"thr_x","pressDiffFirst":false}
// (pressDiffFirst=true opens the Diff panel first so the server list is persisted at revision >= 1;
//  false leaves a fresh thread at revision 0). Defaults below are the author's instance.
let cfg = {};
try { cfg = JSON.parse(await readFile("1773-config.json")); } catch {}
const APP_URL = cfg.appUrl ?? "http://localhost:15908";
const PROJECT_ID = cfg.projectId ?? "proj_wvzf62vtzk";
const THREAD_ID = cfg.threadId ?? "thr_c2k6ff5udf";
const PRESS_DIFF_FIRST = cfg.pressDiffFirst ?? false;
console.log("CONFIG:", JSON.stringify({ APP_URL, PROJECT_ID, THREAD_ID, PRESS_DIFF_FIRST }));

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
  // Ctrl+D toggles the Diff panel (its toolbar button can be off-screen when the
  // right panel is collapsed, so use the keyboard shortcut).
  await page.locator("body").click({ position: { x: 600, y: 300 } });
  // Press Ctrl+D until the Diff panel is showing (aria-pressed on its toolbar button).
  const diffBtn = page.locator('button[aria-label="Show diff panel (Ctrl + D)"]');
  for (let i = 0; i < 4 && (await diffBtn.getAttribute("aria-pressed").catch(() => null)) !== "true"; i++) {
    await page.keyboard.press("Control+d");
    await page.waitForTimeout(1500);
  }
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
