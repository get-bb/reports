// dev-browser script: expand the "Untracked · N files" prompt banner and count
// how many list rows WorkspaceChangesList put in the DOM for a max-h-32 scroll box.
// ---- edit these for your instance ----
const APP = "http://localhost:17792";                       // App URL printed by `scripts/bb-dev-app current`
const THREAD_URL = `${APP}/projects/proj_uzvv6df4kw/threads/thr_6isgdy7qwz`;
// --------------------------------------
const page = await browser.getPage("banner");   // own named page; safe to run in any order
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto(THREAD_URL, { waitUntil: "load" });
const toggle = page.getByRole("button", { name: /Untracked/ }).first();
await toggle.waitFor({ timeout: 90000 });   // first load of the Vite dev build can take a while
await page.waitForTimeout(2500);
const before = await page.evaluate(() => document.querySelectorAll("*").length);
console.log("DOM nodes before expanding banner:", before);
console.log(await saveScreenshot(await page.screenshot(), "1615-banner-collapsed.png"));
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
console.log(await saveScreenshot(await page.screenshot(), "1615-banner-expanded.png"));
