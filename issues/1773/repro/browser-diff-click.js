// dev-browser script: open the Diff panel and click README.md there (a
// discrete click event, like the reporter's flow) to open it in the panel.
const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });
const reqs = [];
page.on("response", async (r) => {
  if (r.url().includes("/tabs")) {
    reqs.push(r.request().method() + " " + r.url() + " => " + r.status());
  }
});
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
await saveScreenshot(await page.screenshot(), "1773-diff.png");
const els = await page.locator("button, a, [role=button]").evaluateAll((els) =>
  els.filter((e) => (e.textContent || "").includes("README")).map((e) => e.tagName + " aria=" + (e.getAttribute("aria-label")||"") + " | " + (e.textContent || "").trim().slice(0, 80)));
console.log(JSON.stringify(els, null, 1));
console.log("REQS:", JSON.stringify(reqs));
