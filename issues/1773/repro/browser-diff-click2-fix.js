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
await page.goto("http://localhost:18477/projects/proj_xmkmev8xtf/threads/thr_vrsxemryh5");
await page.waitForTimeout(6000);
await page.locator('button[aria-label="Show diff panel (Ctrl + D)"]').click();
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
