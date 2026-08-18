// dev-browser script. Usage: edit URL/LOAD_ALL below or pass via page name.
// Opens a thread, optionally mounts the whole history (scroll to top until no
// "Load older" left), then types 67 chars at 25 ms cadence and reports:
//  - component render counts per keystroke (from the renderProbe instrumentation)
//  - CDP Performance metrics deltas (ScriptDuration, LayoutDuration, RecalcStyleDuration, LayoutCount, RecalcStyleCount)
//  - Event Timing durations for input events, and long tasks
const CFG = JSON.parse(await readFile("1304-cfg.json"));
const page = await browser.getPage(CFG.pageName);
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(CFG.url, { waitUntil: "load" });
await page.waitForTimeout(8000);
if (CFG.loadAll) {
  let stable = 0;
  for (let i = 0; i < 60; i++) {
    const state = await page.evaluate(() => {
      const scroller = document.querySelector("[data-thread-window] [data-scroll-container], [data-thread-window] .overflow-y-auto, [data-thread-window] [data-radix-scroll-area-viewport]");
      const rows = document.querySelectorAll("[data-timeline-row-id]").length;
      let target = scroller;
      if (!target) {
        // find the tallest scrollable ancestor of the first timeline row
        let el = document.querySelector("[data-timeline-row-id]");
        while (el && el !== document.body) {
          const cs = getComputedStyle(el);
          if ((cs.overflowY === "auto" || cs.overflowY === "scroll") && el.scrollHeight > el.clientHeight) { target = el; break; }
          el = el.parentElement;
        }
      }
      if (target) target.scrollTop = 0;
      const older = Array.from(document.querySelectorAll("button, span")).some((n) => /older messages/i.test(n.textContent || ""));
      return { rows, older, hasTarget: Boolean(target) };
    });
    if (i % 5 === 0) console.log("scroll pass", i, JSON.stringify(state));
    await page.waitForTimeout(900);
    const rowsNow = await page.evaluate(() => document.querySelectorAll("[data-timeline-row-id]").length);
    if (rowsNow === state.rows) { stable = (stable || 0) + 1; if (stable >= 4) break; } else stable = 0;
  }
  await page.waitForTimeout(1500);
}
const before = await page.evaluate(() => ({
  rows: document.querySelectorAll("[data-timeline-row-id]").length,
  nodes: document.querySelectorAll("*").length,
}));
console.log("mounted:", JSON.stringify(before));
const editor = page.locator('[contenteditable="true"][role="textbox"]').last();
await editor.click();
await page.waitForTimeout(500);
const cdp = await page.context().newCDPSession(page);
await cdp.send("Performance.enable");
const metricsToMap = (m) => Object.fromEntries(m.metrics.map((x) => [x.name, x.value]));
await page.evaluate(() => {
  window.__bbRenderCounts = {};
  window.__bbLong = [];
  window.__bbEvents = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__bbLong.push(Math.round(e.duration)); }).observe({ type: "longtask" });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === "input" || e.name === "keydown") window.__bbEvents.push({ n: e.name, d: Math.round(e.duration), p: Math.round(e.processingEnd - e.processingStart) }); }).observe({ type: "event", durationThreshold: 0 });
});
const m0 = metricsToMap(await cdp.send("Performance.getMetrics"));
const text = CFG.text;
const t0 = Date.now();
for (const ch of text) { await page.keyboard.type(ch); await page.waitForTimeout(25); }
const wall = Date.now() - t0;
await page.waitForTimeout(800);
const m1 = metricsToMap(await cdp.send("Performance.getMetrics"));
const res = await page.evaluate(() => ({ counts: window.__bbRenderCounts, longTasks: window.__bbLong, events: window.__bbEvents }));
const delta = {};
for (const k of ["ScriptDuration", "LayoutDuration", "RecalcStyleDuration", "TaskDuration", "LayoutCount", "RecalcStyleCount", "Nodes", "JSHeapUsedSize"]) delta[k] = k.endsWith("Duration") ? Math.round((m1[k] - m0[k]) * 1000) : m1[k] - m0[k];
const inputs = res.events.filter((e) => e.n === "input");
const out = {
  cfg: CFG, mounted: before, chars: text.length, wallMs: wall, scheduleMs: text.length * 25,
  overheadPerKeyMs: Math.round(((wall - text.length * 25) / text.length) * 10) / 10,
  metricsDeltaMs: delta,
  perKey: { script: Math.round(delta.ScriptDuration / text.length * 10) / 10, layout: Math.round(delta.LayoutDuration / text.length * 10) / 10, style: Math.round(delta.RecalcStyleDuration / text.length * 10) / 10 },
  inputEventDurations: { count: inputs.length, avgTotal: Math.round(inputs.reduce((a, e) => a + e.d, 0) / Math.max(1, inputs.length)), avgProcessing: Math.round(inputs.reduce((a, e) => a + e.p, 0) / Math.max(1, inputs.length)), max: Math.max(0, ...inputs.map((e) => e.d)) },
  longTasks: res.longTasks,
  renderCounts: res.counts,
};
console.log(JSON.stringify(out, null, 1));
await writeFile(CFG.out, JSON.stringify(out, null, 1));
if (CFG.shot) console.log(await saveScreenshot(await page.screenshot(), CFG.shot));
