// dev-browser script: measure the main-thread cost of opening the CSV preview
// with and without 4x CPU throttling (a rough stand-in for a phone). Uses the
// Long Tasks API and JS heap size (Chromium only).
// Runs at 1x then 4x; each run opens its own anonymous page.
// ---- edit these for your instance ----
const APP = "http://localhost:18434";   // Vite dev build
const THREAD_URL = `${APP}/projects/proj_t95uiuqjap/threads/thr_79bfrk39ug`;
// --------------------------------------
async function measure(rate) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  await page.goto(THREAD_URL, { waitUntil: "load" });
  await page.getByRole("button", { name: /(Show|Hide) right panel/ }).first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(2500);
  if (!(await page.getByRole("button", { name: /Hide right panel/ }).count())) {
    await page.getByRole("button", { name: /Show right panel/ }).click({ timeout: 60000 });
    await page.waitForTimeout(800);
  }
  await page.getByRole("button", { name: /New tab/i }).first().click();
  await page.waitForTimeout(600);
  const search = page.getByPlaceholder("Search files");
  await search.fill("big.csv");
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    window.__longTasks = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__longTasks.push(Math.round(e.duration));
    }).observe({ type: "longtask", buffered: false });
    window.__heapBefore = performance.memory ? performance.memory.usedJSHeapSize : null;
    window.__t0 = performance.now();
  });
  await search.press("Enter");
  await page.waitForSelector("table[aria-label$='CSV preview']", { timeout: 60000 });
  await page.waitForTimeout(3000);
  const r = await page.evaluate(() => ({
    longTasksMs: window.__longTasks,
    longTaskTotalMs: window.__longTasks.reduce((a, b) => a + b, 0),
    maxLongTaskMs: Math.max(0, ...window.__longTasks),
    heapBeforeMB: window.__heapBefore ? Math.round(window.__heapBefore / 1048576) : null,
    heapAfterMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
    td: document.querySelectorAll("td").length,
  }));
  console.log(`cpuThrottle=${rate}x`, JSON.stringify(r));
  await page.close();
}
await measure(1);
await measure(4);
