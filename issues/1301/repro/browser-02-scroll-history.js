// dev-browser script: hold "scroll to top" on the open thread page until every
// older page has loaded. After each page lands, record DOM node count, mounted
// timeline rows, scroll height and the long tasks (>50ms) observed so far.
const page = await browser.getPage("thread");
await page.evaluate(() => {
  window.__bb1301 = { longTasks: [], samples: [] };
  const po = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__bb1301.longTasks.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) });
  });
  po.observe({ type: "longtask", buffered: true });
  window.__bb1301.po = po;
});
const scrollerSel = ".thread-scrollbar";
const sample = async (label) => page.evaluate((label) => {
  const el = document.querySelector(".thread-scrollbar");
  const s = {
    label,
    t: Math.round(performance.now()),
    nodes: document.getElementsByTagName("*").length,
    rows: document.querySelectorAll("[data-timeline-row-id]").length,
    scrollHeight: el.scrollHeight,
    scrollTop: el.scrollTop,
    longTasks: window.__bb1301.longTasks.length,
    loadOlderVisible: !!Array.from(document.querySelectorAll("[role=status]")).find(e => e.textContent.includes("older")),
  };
  window.__bb1301.samples.push(s);
  return s;
}, label);
console.log(JSON.stringify(await sample("before")));
let lastRows = -1; let stable = 0; let i = 0;
while (i < 40) {
  i += 1;
  await page.evaluate(() => { const el = document.querySelector(".thread-scrollbar"); el.scrollTop = 0; el.dispatchEvent(new Event("scroll")); });
  await page.waitForTimeout(1500);
  const s = await sample("page-" + i);
  console.log(JSON.stringify(s));
  if (s.rows === lastRows) { stable += 1; if (stable >= 3) break; } else stable = 0;
  lastRows = s.rows;
}
const result = await page.evaluate(() => ({ longTasks: window.__bb1301.longTasks, samples: window.__bb1301.samples }));
console.log("LONGTASKS " + JSON.stringify(result.longTasks));
await writeFile("1301-scroll-result.json", JSON.stringify(result, null, 2));
const shot = await page.screenshot();
console.log(await saveScreenshot(shot, "1301-after-scroll-top.png"));
