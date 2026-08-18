// Type N chars into the composer, count component renders per keystroke and measure wall time.
const page = await browser.getPage("bb1304b");
const info = await page.evaluate(() => {
  const ta = document.querySelector("textarea");
  const ce = document.querySelector('[contenteditable="true"]');
  return { textarea: ta ? ta.outerHTML.slice(0, 200) : null, ce: ce ? ce.outerHTML.slice(0, 200) : null,
    rows: document.querySelectorAll("[data-timeline-row-id]").length, nodes: document.querySelectorAll("*").length };
});
console.log(JSON.stringify(info));
const editor = page.locator('[contenteditable="true"], textarea').first();
await editor.click();
await page.evaluate(() => { window.__bbRenderCounts = {}; window.__bbLong = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__bbLong.push(Math.round(e.duration)); }).observe({ type: "longtask" }); });
const text = "The quick brown fox jumps over the lazy dog and keeps typing more words";
const t0 = Date.now();
for (const ch of text) { await page.keyboard.type(ch); await page.waitForTimeout(25); }
const wall = Date.now() - t0;
await page.waitForTimeout(500);
const res = await page.evaluate(() => ({ counts: window.__bbRenderCounts, longTasks: window.__bbLong }));
console.log(JSON.stringify({ chars: text.length, wallMs: wall, scheduleMs: text.length * 25, ...res }));
