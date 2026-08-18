// dev-browser script: install a minimal React DevTools hook BEFORE the app loads
// so we can count, per commit, every fiber that performed work (rendered), by
// component name. Then type into the composer and dump the tally.
const CFG = JSON.parse(await readFile("1304-cfg.json"));
const page = await browser.getPage(CFG.pageName);
await page.setViewportSize({ width: 1280, height: 900 });
const cdp0 = await page.context().newCDPSession(page);
await cdp0.send("Page.enable");
await cdp0.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
  const tally = {};
  const hook = {
    supportsFiber: true,
    renderers: new Map(),
    _n: 0,
    inject(renderer) { const id = ++this._n; this.renderers.set(id, renderer); return id; },
    checkDCE() {},
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    onCommitFiberRoot(id, root) {
      if (window.__bbTallyOn) window.__bbCommits = (window.__bbCommits || 0) + 1;
      // A fiber that rendered in this commit gets a fresh actualStartTime
      // (profiling DEV build). Untouched fibers keep their old one, and their
      // stale flags, so we can't use PerformedWork here.
      const seen = (window.__bbSeenStart ||= new WeakMap());
      const stack = [root.current];
      while (stack.length) {
        const f = stack.pop();
        const st = f.actualStartTime;
        const prev = seen.get(f);
        seen.set(f, st);
        if (window.__bbTallyOn && prev !== undefined && prev !== st && typeof st === "number" && st >= 0) {
          const t = f.type;
          const name = typeof t === "function" ? (t.displayName || t.name || "anon") : t && typeof t === "object" ? (t.displayName || (t.render && (t.render.displayName || t.render.name)) || (t.type && (t.type.displayName || t.type.name)) || "obj") : typeof t === "string" ? "host:" + t : String(f.tag);
          tally[name] = (tally[name] || 0) + 1;
          if ((f.flags & 1) !== 0) { const r = (window.__bbRendered ||= {}); r[name] = (r[name] || 0) + 1; }
        }
        if (f.child) stack.push(f.child);
        if (f.sibling) stack.push(f.sibling);
      }
    },
  };
  window.__bbTally = tally;
  Object.defineProperty(window, "__REACT_DEVTOOLS_GLOBAL_HOOK__", { value: hook, configurable: false, writable: false });
})();` });
await page.goto(CFG.url, { waitUntil: "load" });
await page.waitForTimeout(8000);
if (CFG.loadAll) {
  let stable = 0;
  for (let i = 0; i < 60; i++) {
    const rows0 = await page.evaluate(() => {
      let el = document.querySelector("[data-timeline-row-id]"); let target = null;
      while (el && el !== document.body) { const cs = getComputedStyle(el); if ((cs.overflowY === "auto" || cs.overflowY === "scroll") && el.scrollHeight > el.clientHeight) { target = el; break; } el = el.parentElement; }
      if (target) target.scrollTop = 0;
      return document.querySelectorAll("[data-timeline-row-id]").length;
    });
    await page.waitForTimeout(900);
    const rows1 = await page.evaluate(() => document.querySelectorAll("[data-timeline-row-id]").length);
    if (rows1 === rows0) { if (++stable >= 4) break; } else stable = 0;
  }
  await page.waitForTimeout(1500);
}
const mounted = await page.evaluate(() => ({ rows: document.querySelectorAll("[data-timeline-row-id]").length, nodes: document.querySelectorAll("*").length, hookInstalled: Boolean(window.__REACT_DEVTOOLS_GLOBAL_HOOK__ && window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers.size) }));
console.log("mounted:", JSON.stringify(mounted));
const editor = page.locator('[contenteditable="true"][role="textbox"]').last();
await editor.click();
await page.waitForTimeout(500);
await page.evaluate(() => { for (const k of Object.keys(window.__bbTally)) delete window.__bbTally[k]; window.__bbRendered = {}; window.__bbCommits = 0; window.__bbTallyOn = true; });
const text = CFG.text;
for (const ch of text) { await page.keyboard.type(ch); await page.waitForTimeout(25); }
await page.waitForTimeout(500);
const res = await page.evaluate(() => { window.__bbTallyOn = false; return { commits: window.__bbCommits, tally: window.__bbTally, rendered: window.__bbRendered || {} }; });
const renderedSorted = Object.entries(res.rendered).sort((a, b) => b[1] - a[1]);
const sorted = Object.entries(res.tally).sort((a, b) => b[1] - a[1]);
const out = { mounted, chars: text.length, commits: res.commits, distinctVisited: sorted.length, totalFibersVisited: sorted.reduce((a, [, v]) => a + v, 0), totalFibersRendered: renderedSorted.reduce((a, [, v]) => a + v, 0), topVisited: sorted.slice(0, 40), rendered: renderedSorted };
console.log(JSON.stringify(out, null, 1));
await writeFile(CFG.out, JSON.stringify({ ...out, allVisited: sorted }, null, 1));
