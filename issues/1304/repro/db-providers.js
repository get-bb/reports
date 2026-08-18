// dev-browser script: install a minimal React DevTools hook BEFORE the app loads.
// On every commit while typing, walk the fiber tree and tally every context
// Provider fiber whose `value` prop differs (Object.is) from its alternate —
// i.e. providers whose value changed in that commit. Also records the size of
// the subtree below each changed provider (fibers) to show the propagation cost.
const CFG = JSON.parse(await readFile("1304-cfg.json"));
const page = await browser.getPage(CFG.pageName);
await page.setViewportSize({ width: 1280, height: 900 });
const cdp0 = await page.context().newCDPSession(page);
await cdp0.send("Page.enable");
await cdp0.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
  const tally = {};
  const nameOf = (f) => { const t = f && f.type; return typeof t === "function" ? (t.displayName || t.name || "anon") : typeof t === "string" ? t : t && typeof t === "object" ? (t.displayName || (t.render && (t.render.displayName || t.render.name)) || (t.type && (t.type.displayName || t.type.name)) || (t._context && t._context.displayName) || "obj") : String(f && f.tag); };
  const ownerChain = (f) => { const out = []; let p = f.return; while (p && out.length < 4) { if (typeof p.type === "function" || (p.type && typeof p.type === "object" && p.tag !== 10)) out.push(nameOf(p)); p = p.return; } return out.join(" < "); };
  const subtreeSize = (f) => { let n = 0; const st = [f.child]; while (st.length) { const x = st.pop(); if (!x) continue; n++; if (x.child) st.push(x.child); if (x.sibling) st.push(x.sibling); } return n; };
  const hook = {
    supportsFiber: true, renderers: new Map(), _n: 0,
    inject(renderer) { const id = ++this._n; this.renderers.set(id, renderer); return id; },
    checkDCE() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
    onCommitFiberRoot(id, root) {
      if (window.__bbTallyOn) window.__bbCommits = (window.__bbCommits || 0) + 1;
      const stack = [root.current];
      while (stack.length) {
        const f = stack.pop();
        const seen = (window.__bbSeenStart ||= new WeakMap());
        const st = f.actualStartTime; const prev = seen.get(f); seen.set(f, st);
        const visited = prev !== undefined && prev !== st && typeof st === "number" && st >= 0;
        if (window.__bbTallyOn && f.tag === 10) { const c = (window.__bbDbg ||= {v:0,t:0}); c.t++; if (visited) c.v++; }
        if (visited && f.tag === 10 && f.alternate && f.alternate.memoizedProps && f.memoizedProps) {
          const cur = f.memoizedProps.value, alt = f.alternate.memoizedProps.value;
          if (window.__bbTallyOn && !Object.is(cur, alt)) {
            const ctx = f.type && (f.type._context || f.type);
            const key = (ctx && ctx.displayName ? ctx.displayName : "ctx") + " @ " + ownerChain(f);
            const e = (tally[key] ||= { changes: 0, subtree: 0, sample: "" });
            e.changes++;
            e.subtree = subtreeSize(f);
            if (!e.sample) { try { e.sample = cur && typeof cur === "object" ? "{" + Object.keys(cur).slice(0, 8).join(",") + "}" : typeof cur === "function" ? "fn:" + String(cur).replace(/\\s+/g, " ").slice(0, 160) : String(cur).slice(0, 60); } catch { e.sample = "?"; } }
          }
        }
        if (f.child) stack.push(f.child);
        if (f.sibling) stack.push(f.sibling);
      }
    },
  };
  window.__bbProviderTally = tally;
  Object.defineProperty(window, "__REACT_DEVTOOLS_GLOBAL_HOOK__", { value: hook, configurable: false, writable: false });
})();` });
await page.goto(CFG.url, { waitUntil: "load" });
await page.waitForTimeout(8000);
const mounted = await page.evaluate(() => ({ rows: document.querySelectorAll("[data-timeline-row-id]").length, nodes: document.querySelectorAll("*").length }));
console.log("mounted:", JSON.stringify(mounted));
const editor = page.locator('[contenteditable="true"][role="textbox"]').last();
await editor.click();
await page.waitForTimeout(500);
await page.evaluate(() => { window.__bbCommits = 0; window.__bbTallyOn = true; });
for (const ch of CFG.text) { await page.keyboard.type(ch); await page.waitForTimeout(25); }
await page.waitForTimeout(500);
const res = await page.evaluate(() => { window.__bbTallyOn = false; return { commits: window.__bbCommits, tally: window.__bbProviderTally, dbg: window.__bbDbg }; });
const out = { dbg: res.dbg, mounted, chars: CFG.text.length, commits: res.commits, changedProviders: Object.entries(res.tally).sort((a, b) => b[1].changes - a[1].changes) };
console.log(JSON.stringify(out, null, 1));
await writeFile(CFG.out, JSON.stringify(out, null, 1));
