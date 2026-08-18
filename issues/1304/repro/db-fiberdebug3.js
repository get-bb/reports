const CFG = JSON.parse(await readFile("1304-cfg.json"));
const page = await browser.getPage(CFG.pageName);
const r = await page.evaluate(() => {
  const el = document.querySelector('[data-timeline-row-id]');
  const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
  let f = el[key];
  while (f.return) f = f.return;
  const root = f.stateNode;
  const h = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  window.__bbTallyOn = true;
  let err = null;
  try { h.onCommitFiberRoot(1, root); } catch (e) { err = String(e && e.stack || e); }
  window.__bbTallyOn = false;
  return { tallyType: typeof window.__bbTally, seen: typeof window.__bbSeenStart, err, commits: window.__bbCommits, rendererIds: [...h.renderers.keys()] };
});
console.log(JSON.stringify(r, null, 1));
