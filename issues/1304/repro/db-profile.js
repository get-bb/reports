// dev-browser script: CPU-profile typing into the composer on an already-open page
// (run db-measure.js first with the same pageName). Aggregates self time by function.
const CFG = JSON.parse(await readFile("1304-cfg.json"));
const page = await browser.getPage(CFG.pageName);
const editor = page.locator('[contenteditable="true"][role="textbox"]').last();
await editor.click();
await page.keyboard.press("Control+A");
await page.keyboard.press("Backspace");
await page.waitForTimeout(500);
const cdp = await page.context().newCDPSession(page);
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
await cdp.send("Profiler.start");
const text = CFG.text;
for (const ch of text) { await page.keyboard.type(ch); await page.waitForTimeout(25); }
await page.waitForTimeout(300);
const { profile } = await cdp.send("Profiler.stop");
// Aggregate self time per node (function) and total time by walking the tree.
const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
const selfMs = new Map();
const dt = profile.timeDeltas;
for (let i = 0; i < profile.samples.length; i++) {
  const id = profile.samples[i];
  selfMs.set(id, (selfMs.get(id) || 0) + (dt[i] || 0) / 1000);
}
const totalMs = new Map();
for (const [id, ms] of selfMs) {
  let cur = id;
  const seen = new Set();
  while (cur !== undefined) {
    const n = nodes.get(cur);
    const key = n.callFrame.functionName + " @ " + (n.callFrame.url || "").split("/src/").pop().split("?")[0];
    if (!seen.has(key)) { totalMs.set(key, (totalMs.get(key) || 0) + ms); seen.add(key); }
    cur = parent.get(cur);
  }
}
const selfByFn = new Map();
for (const [id, ms] of selfMs) {
  const n = nodes.get(id);
  const key = n.callFrame.functionName + " @ " + (n.callFrame.url || "").split("/src/").pop().split("?")[0];
  selfByFn.set(key, (selfByFn.get(key) || 0) + ms);
}
const total = [...selfMs.values()].reduce((a, b) => a + b, 0);
const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${v.toFixed(1).padStart(8)} ms  ${k}`);
const out = {
  profileTotalMs: Math.round(total),
  chars: text.length,
  topSelf: top(selfByFn, 40),
  topTotal: top(totalMs, 60),
  interesting: [...totalMs.entries()].filter(([k]) => /ThreadDetailView|ThreadDetailPromptArea|PromptBoxInternal|ThreadTimelineSurface|ThreadTimelineRows|TimelineRow|EmbeddedThreadChat|ThreadDetailSecondaryContent|SplitThreadArea|ProjectRow|ProjectList|Sidebar|Lexical|renderWithHooks|performWorkOnRoot|commitRoot|flushPassiveEffects|writePromptDraft|Prosemirror|prosemirror|lexical/i.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 60).map(([k, v]) => `${v.toFixed(1).padStart(8)} ms  ${k}`),
};
console.log(JSON.stringify(out, null, 1));
await writeFile(CFG.out.replace(".json", "-profile.json"), JSON.stringify(out, null, 1));
