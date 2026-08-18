// dev-browser script (PR #1384 branch): reload the thread, wheel-scroll to the
// top of history, then scroll back down in wheel bursts. After each burst +
// 600ms idle, count wrappers that intersect the viewport but are still
// placeholders (blank areas the user would see).
const page = await browser.getPage("thread");
await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://localhost:13028/projects/proj_mgvp7iamvh/threads/thr_wfjb5qctw4", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2500);
const sample = (label) => page.evaluate((label) => {
  const el = document.querySelector(".thread-scrollbar");
  if (!el) return { label, error: "no scroller", url: location.href };
  const r = el.getBoundingClientRect();
  const wrappers = Array.from(document.querySelectorAll("[data-timeline-row-realized]"));
  const visible = wrappers.filter((w) => { const b = w.getBoundingClientRect(); return b.bottom > r.top && b.top < r.bottom && b.height > 0; });
  const blankVisible = visible.filter((w) => w.dataset.timelineRowRealized !== "true");
  return { label, nodes: document.getElementsByTagName("*").length, rows: wrappers.length, realized: document.querySelectorAll('[data-timeline-row-realized="true"]').length, visible: visible.length, blankVisible: blankVisible.length, blankIds: blankVisible.slice(0,3).map(w=>w.dataset.timelineRowId), scrollTop: Math.round(el.scrollTop), scrollHeight: el.scrollHeight };
}, label);
await page.mouse.move(195, 400);
for (let i = 1; i <= 8; i++) {
  for (let k = 0; k < 40; k++) { await page.mouse.wheel(0, -1500); await page.waitForTimeout(20); }
  await page.waitForTimeout(800);
  const s = await sample("up-" + i);
  if (s.scrollTop === 0 && s.rows >= 820) { console.log(JSON.stringify(s)); break; }
}
for (let i = 1; i <= 40; i++) {
  for (let k = 0; k < 6; k++) { await page.mouse.wheel(0, 700); await page.waitForTimeout(30); }
  await page.waitForTimeout(600);
  const s = await sample("down-" + i);
  console.log(JSON.stringify(s));
  if (s.scrollTop >= s.scrollHeight - 900) break;
}
console.log(await saveScreenshot(await page.screenshot(), "1301-pr1384-after-scroll-down.png"));
