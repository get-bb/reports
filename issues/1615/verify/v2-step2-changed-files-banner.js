// dev-browser script: expand the "Untracked · N files" prompt banner and count
// how many list rows WorkspaceChangesList put in the DOM for a max-h-32 scroll box.
const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:14231/projects/proj_zfaz9fujtc/threads/thr_5wvm6uxwjk", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const before = await page.evaluate(() => document.querySelectorAll("*").length);
console.log("DOM nodes before expanding banner:", before);
const toggle = page.getByRole("button", { name: /Untracked/ }).first();
await toggle.waitFor({ timeout: 15000 });
console.log(await saveScreenshot(await page.screenshot(), "1615-v2-banner-collapsed.png"));
const t0 = Date.now();
await toggle.click();
await page.waitForTimeout(1500);
const t1 = Date.now();
const stats = await page.evaluate(() => {
  const list = document.querySelector('ul[class*="max-h-32"]');
  const rect = list ? list.getBoundingClientRect() : null;
  return {
    totalNodes: document.querySelectorAll("*").length,
    listRows: list ? list.querySelectorAll("li").length : -1,
    listClass: list ? list.className : null,
    listBox: rect ? { h: Math.round(rect.height), w: Math.round(rect.width) } : null,
    scrollHeight: list ? list.scrollHeight : null,
    listNodes: list ? list.querySelectorAll("*").length : -1,
  };
});
console.log("after expand:", JSON.stringify(stats), "elapsed ms (incl 1500ms wait):", t1 - t0);
console.log(await saveScreenshot(await page.screenshot(), "1615-v2-banner-expanded.png"));
