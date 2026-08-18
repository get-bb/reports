// dev-browser script (one page load): installs a minimal React DevTools hook
// before the app loads, opens a thread (optionally mounting all history), types
// CFG.text into the composer at 25 ms cadence while CPU-profiling, and reports:
//  - fibers that actually rendered per commit (PerformedWork flag on fibers
//    visited in that commit), by component name
//  - context Provider fibers (visited in the commit) whose value changed, with
//    the size of the subtree React must scan for consumers
//  - CPU profile self time by function (top 25) plus a few named functions
//  - the renderProbe counters (if the instrumentation diff is applied)
// Usage: write ~/.dev-browser/tmp/1304-cfg.json then
//   dev-browser --browser <name> --headless run db-all.js
// cfg: { pageName (must be NEW per run), url, loadAll, text, out }
const CFG = JSON.parse(await readFile("1304-cfg.json"));
const page = await browser.getPage(CFG.pageName);
await page.setViewportSize({ width: 1280, height: 900 });
const cdp = await page.context().newCDPSession(page);
await cdp.send("Page.enable");
await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
  const nameOf = (f) => { const t = f && f.type; return typeof t === "function" ? (t.displayName || t.name || "anon") : typeof t === "string" ? "host:" + t : t && typeof t === "object" ? (t.displayName || (t.render && (t.render.displayName || t.render.name)) || (t.type && (t.type.displayName || t.type.name)) || "obj") : String(f && f.tag); };
  const ownerChain = (f) => { const out = []; let p = f.return; while (p && out.length < 3) { if (typeof p.type === "function") out.push(nameOf(p)); p = p.return; } return out.join(" < "); };
  const subtreeSize = (f) => { let n = 0; const st = [f.child]; while (st.length) { const x = st.pop(); if (!x) continue; n++; if (x.child) st.push(x.child); if (x.sibling) st.push(x.sibling); } return n; };
  window.__bbRendered = {}; window.__bbProviders = {}; window.__bbCommits = 0; window.__bbRenderedTotal = 0;
  const seen = new WeakMap();
  const hook = {
    supportsFiber: true, renderers: new Map(), _n: 0,
    inject(renderer) { const id = ++this._n; this.renderers.set(id, renderer); return id; },
    checkDCE() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
    onCommitFiberRoot(id, root) {
      const on = window.__bbTallyOn;
      if (on) window.__bbCommits++;
      const stack = [root.current];
      while (stack.length) {
        const f = stack.pop();
        const st = f.actualStartTime; const prev = seen.get(f); seen.set(f, st);
        const visited = prev !== undefined && prev !== st && typeof st === "number" && st >= 0;
        if (on && visited) {
          if ((f.flags & 1) !== 0 && (f.tag === 0 || f.tag === 11 || f.tag === 14 || f.tag === 15 || f.tag === 1)) {
            const n = nameOf(f); window.__bbRendered[n] = (window.__bbRendered[n] || 0) + 1; window.__bbRenderedTotal++;
          }
          if (f.tag === 10 && f.alternate && f.alternate.memoizedProps && f.memoizedProps) {
            const cur = f.memoizedProps.value, alt = f.alternate.memoizedProps.value;
            if (!Object.is(cur, alt)) {
              const key = "Provider under " + ownerChain(f);
              const e = (window.__bbProviders[key] ||= { changes: 0, subtree: 0, sample: "" });
              e.changes++; e.subtree = subtreeSize(f);
              if (!e.sample) { try { e.sample = cur && typeof cur === "object" ? "{" + Object.keys(cur).slice(0, 8).join(",") + "}" : typeof cur === "function" ? "fn:" + String(cur).replace(/\\s+/g, " ").slice(0, 100) : String(cur).slice(0, 60); } catch { e.sample = "?"; } }
            }
          }
        }
        if (f.child) stack.push(f.child);
        if (f.sibling) stack.push(f.sibling);
      }
    },
  };
  Object.defineProperty(window, "__REACT_DEVTOOLS_GLOBAL_HOOK__", { value: hook, configurable: false, writable: false });
})();` });
await page.goto(CFG.url, { waitUntil: "load" });
await page.waitForTimeout(8000);
if (CFG.loadAll) {
  let stable = 0;
  for (let i = 0; i < 80; i++) {
    const rows0 = await page.evaluate(() => {
      let el = document.querySelector("[data-timeline-row-id]"); let target = null;
      while (el && el !== document.body) { const cs = getComputedStyle(el); if ((cs.overflowY === "auto" || cs.overflowY === "scroll") && el.scrollHeight > el.clientHeight) { target = el; break; } el = el.parentElement; }
      if (target) target.scrollTop = 0;
      return document.querySelectorAll("[data-timeline-row-id]").length;
    });
    await page.waitForTimeout(900);
    const rows1 = await page.evaluate(() => document.querySelectorAll("[data-timeline-row-id]").length);
    if (rows1 === rows0) { if (++stable >= 5) break; } else stable = 0;
  }
  await page.waitForTimeout(1500);
}
const mounted = await page.evaluate(() => ({ rows: document.querySelectorAll("[data-timeline-row-id]").length, nodes: document.querySelectorAll("*").length, markdownAnchors: document.querySelectorAll("[data-timeline-row-id] a").length }));
console.log("mounted:", JSON.stringify(mounted));
const editor = page.locator('[contenteditable="true"][role="textbox"]').last();
await editor.click();
await page.waitForTimeout(500);
await page.evaluate(() => { window.__bbRenderCounts = {}; window.__bbRendered = {}; window.__bbProviders = {}; window.__bbCommits = 0; window.__bbRenderedTotal = 0; window.__bbTallyOn = true; window.__bbLong = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__bbLong.push(Math.round(e.duration)); }).observe({ type: "longtask" }); });
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
await cdp.send("Profiler.start");
const t0 = Date.now();
for (const ch of CFG.text) { await page.keyboard.type(ch); await page.waitForTimeout(25); }
const wall = Date.now() - t0;
await page.waitForTimeout(400);
const { profile } = await cdp.send("Profiler.stop");
const res = await page.evaluate(() => { window.__bbTallyOn = false; return { commits: window.__bbCommits, rendered: window.__bbRendered, renderedTotal: window.__bbRenderedTotal, providers: window.__bbProviders, probes: window.__bbRenderCounts, longTasks: window.__bbLong }; });
// profile aggregation
const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
const selfMs = new Map();
for (let i = 0; i < profile.samples.length; i++) selfMs.set(profile.samples[i], (selfMs.get(profile.samples[i]) || 0) + (profile.timeDeltas[i] || 0) / 1000);
const selfByFn = new Map();
let total = 0, idle = 0;
for (const [id, ms] of selfMs) {
  const n = nodes.get(id);
  const fn = n.callFrame.functionName || "(anonymous)";
  const key = fn + " @ " + (n.callFrame.url || "").split("/").pop().split("?")[0];
  selfByFn.set(key, (selfByFn.get(key) || 0) + ms);
  total += ms; if (fn === "(idle)") idle += ms;
}
const topSelf = [...selfByFn.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${v.toFixed(1).padStart(8)} ms  ${k}`);
const named = {};
for (const [k, v] of selfByFn) { for (const want of ["propagateParentContextChanges", "propagateContextChanges", "ThreadDetailViewInternal", "PromptBoxInternal", "ThreadDetailPromptArea", "MarkdownAnchor", "jsxDEV", "collapse", "caretPositionFromPoint"]) if (k.startsWith(want + " @")) named[want] = Math.round(((named[want] || 0) + v) * 10) / 10; }
const N = CFG.text.length;
const out = {
  cfg: CFG, mounted, chars: N, wallMs: wall, scheduleMs: N * 25, overheadPerKeyMs: Math.round(((wall - N * 25) / N) * 10) / 10,
  cpuBusyMs: Math.round(total - idle), cpuBusyPerKeyMs: Math.round((total - idle) / N * 10) / 10,
  commits: res.commits, renderedFibersPerKey: Math.round(res.renderedTotal / N * 10) / 10,
  renderedTop: Object.entries(res.rendered).sort((a, b) => b[1] - a[1]).slice(0, 60),
  renderedMarkdown: Object.entries(res.rendered).filter(([k]) => /Markdown|Anchor|Timeline|Row/.test(k)).sort((a, b) => b[1] - a[1]),
  changedProviders: Object.entries(res.providers).sort((a, b) => b[1].changes - a[1].changes),
  probes: res.probes, longTasks: res.longTasks, namedSelfMs: named, topSelf,
};
console.log(JSON.stringify(out, null, 1));
await writeFile(CFG.out, JSON.stringify(out, null, 1));
