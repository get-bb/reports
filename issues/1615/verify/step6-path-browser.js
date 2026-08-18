// dev-browser script: open the New project dialog, browse to /tmp/1615-qa-verify/manyfiles
// (5000 files) in RemotePathBrowser and count the rows in the h-56 scroll box.
const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:15040/projects/proj_uy6nvf8nfy/threads/thr_pm9wxhqkwb", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.getByRole("button", { name: "New project", exact: true }).click({ force: true });
await page.waitForTimeout(1200);
console.log(await saveScreenshot(await page.screenshot(), "1615-verify-newproject.png"));
const editBtn = page.getByRole("button", { name: "Edit path" });
if (await editBtn.count()) { await editBtn.click(); await page.waitForTimeout(300); }
const input = page.getByLabel("Project path");
console.log("input count", await input.count());
if (await input.count()) {
  await input.fill("/tmp/1615-qa-verify/manyfiles");
  const before = await page.evaluate(() => document.querySelectorAll("*").length);
  const t0 = Date.now();
  await input.press("Enter");
  await page.waitForFunction(() => document.querySelectorAll('div[class*="h-56"] li').length > 100, null, { timeout: 30000 });
  await page.waitForTimeout(1000);
  const t1 = Date.now();
  const stats = await page.evaluate(() => {
    const box = document.querySelector('div[class*="h-56"]');
    const rect = box.getBoundingClientRect();
    return { nodesBefore: null, totalNodes: document.querySelectorAll("*").length, rows: box.querySelectorAll("li").length, boxH: Math.round(rect.height), scrollH: box.scrollHeight, boxNodes: box.querySelectorAll("*").length };
  });
  stats.nodesBefore = before;
  console.log("path browser:", JSON.stringify(stats), "ms:", t1 - t0);
  console.log(await saveScreenshot(await page.screenshot(), "1615-verify-path-browser.png"));
}
