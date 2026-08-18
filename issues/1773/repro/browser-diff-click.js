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
await page.goto("http://localhost:18477/projects/proj_xmkmev8xtf/threads/thr_vrsxemryh5");
await page.waitForTimeout(6000);
await page.locator('button[aria-label="Show diff panel (Ctrl + D)"]').click();
await page.waitForTimeout(3000);
await saveScreenshot(await page.screenshot(), "1773-diff.png");
const els = await page.locator("button, a, [role=button]").evaluateAll((els) =>
  els.filter((e) => (e.textContent || "").includes("README")).map((e) => e.tagName + " aria=" + (e.getAttribute("aria-label")||"") + " | " + (e.textContent || "").trim().slice(0, 80)));
console.log(JSON.stringify(els, null, 1));
console.log("REQS:", JSON.stringify(reqs));
