// dev-browser script (continues browser-diff-click.js): click "Open README.md"
// in the Diff panel, poll the tab strip, capture the toast, then reload to see
// whether the Docs tab survived.
const page = await browser.getPage("main");
const reqs = [];
page.on("response", async (r) => {
  if (r.url().includes("/tabs")) {
    reqs.push(r.request().method() + " " + r.url() + " => " + r.status());
  }
});
await page.setViewportSize({ width: 1400, height: 900 });
// Configure for your instance via ~/.dev-browser/tmp/1773-config.json
//   {"appUrl":"http://localhost:<app port>","projectId":"proj_x","threadId":"thr_x"}
// Run with: dev-browser --browser <name> --headless --timeout 120 run <this file>
let cfg = {};
try { cfg = JSON.parse(await readFile("1773-config.json")); } catch {}
const APP_URL = cfg.appUrl ?? "http://localhost:15908";
const PROJECT_ID = cfg.projectId ?? "proj_wvzf62vtzk";
const THREAD_ID = cfg.threadId ?? "thr_c2k6ff5udf";
console.log("CONFIG:", JSON.stringify({ APP_URL, PROJECT_ID, THREAD_ID }));
await page.goto(`${APP_URL}/projects/${PROJECT_ID}/threads/${THREAD_ID}`);
await page.waitForTimeout(6000);
// Ctrl+D toggles the Diff panel (keyboard shortcut; the toolbar button can be
// off-screen when the right panel is collapsed).
await page.locator("body").click({ position: { x: 600, y: 300 } });
// Press Ctrl+D until the README.md file header in the Diff panel is actually
// visible (Ctrl+D toggles, and the right panel may start collapsed).
// (A collapsed right panel keeps its content in the DOM but clipped, so check
// the header's bounding box is inside the viewport rather than isVisible().)
const readmeHeader = page.locator("button").filter({ hasText: /^\u200eREADME\.md$/ }).first();
const headerOnScreen = async () => {
  const box = await readmeHeader.boundingBox().catch(() => null);
  return box !== null && box.x + box.width <= 1400 && box.width > 0;
};
for (let i = 0; i < 4 && !(await headerOnScreen()); i++) {
  await page.keyboard.press("Control+d");
  await page.waitForTimeout(1500);
}
await page.waitForTimeout(3000);
const openBtn = page.locator("button").filter({ hasText: /^\u200eREADME\.md$/ }).first();
console.log("open button count:", await openBtn.count());
await openBtn.click();
const t0 = Date.now();
const timeline = [];
let toastText = "";
let shot = false;
let docsShot = false;
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(150);
  const strip = await page
    .locator("[data-tab-pill-close]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  const original = await page.getByText("Original", { exact: true }).count();
  const entry = JSON.stringify(strip) + " originalToggle=" + original;
  if (timeline.length === 0 || timeline[timeline.length - 1].split("|")[1] !== entry) {
    timeline.push((Date.now() - t0) + "ms|" + entry);
  }
  if (original > 0 && !docsShot) {
    docsShot = true;
    await saveScreenshot(await page.screenshot(), "1773-fix-docs-open.png");
  }
  const t = await page.locator("[data-sonner-toast]").allInnerTexts();
  if (t.length > 0 && t.join("").trim() !== "" && !shot) {
    shot = true;
    toastText = t.join("\n---\n");
    await saveScreenshot(await page.screenshot(), "1773-fix-toast.png");
  }
}
console.log("STRIP TIMELINE:\n" + timeline.join("\n"));
console.log("TOAST:", JSON.stringify(toastText));
console.log("REQS:", JSON.stringify(reqs));
await saveScreenshot(await page.screenshot(), "1773-fix-after.png");
await page.reload();
await page.waitForTimeout(6000);
const stripAfterReload = await page
  .locator("[data-tab-pill-close]")
  .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
console.log("STRIP AFTER RELOAD:", JSON.stringify(stripAfterReload));
await saveScreenshot(await page.screenshot(), "1773-fix-reload.png");
