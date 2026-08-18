// dev-browser script: reload the thread, then scroll up with real wheel events
// (like a user flicking upward) until history is exhausted. Records DOM/rows
// after each burst and lists long tasks.
const page = await browser.getPage("thread");
await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://localhost:13028/projects/proj_mgvp7iamvh/threads/thr_wfjb5qctw4", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2500);
await page.evaluate(() => {
  window.__bb1301 = { longTasks: [], samples: [] };
  const po = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__bb1301.longTasks.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) });
  });
  po.observe({ type: "longtask", buffered: false });
});
const sample = (label) => page.evaluate((label) => {
  const el = document.querySelector(".thread-scrollbar");
  return { label, nodes: document.getElementsByTagName("*").length, rows: document.querySelectorAll("[data-timeline-row-id]").length, scrollHeight: el.scrollHeight, scrollTop: el.scrollTop, longTasks: window.__bb1301.longTasks.length };
}, label);
console.log(JSON.stringify(await sample("before")));
await page.mouse.move(195, 400);
let lastRows = -1, stable = 0, tookMid = false;
for (let i = 1; i <= 60; i++) {
  for (let k = 0; k < 40; k++) { await page.mouse.wheel(0, -1500); await page.waitForTimeout(20); }
  await page.waitForTimeout(800);
  const s = await sample("burst-" + i);
  console.log(JSON.stringify(s));
  if (!tookMid && s.rows > 300) { tookMid = true; console.log(await saveScreenshot(await page.screenshot(), "1301-mid-scroll.png")); }
  if (s.rows === lastRows && s.scrollTop === 0) { stable += 1; if (stable >= 2) break; } else stable = 0;
  lastRows = s.rows;
}
const lt = await page.evaluate(() => window.__bb1301.longTasks);
console.log("LONGTASKS " + JSON.stringify(lt));
console.log(await saveScreenshot(await page.screenshot(), "1301-top-of-history.png"));
