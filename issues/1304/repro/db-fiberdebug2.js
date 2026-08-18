const CFG = JSON.parse(await readFile("1304-cfg.json"));
const page = await browser.getPage(CFG.pageName);
const r = await page.evaluate(() => {
  const el = document.querySelector('[data-timeline-row-id]');
  const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
  let f = el[key];
  while (f.return) f = f.return;
  const root = f.stateNode;
  const seen = window.__bbSeenStart;
  let n = 0, undef = 0, same = 0, diff = 0, neg = 0;
  const stack = [root.current];
  while (stack.length) {
    const x = stack.pop(); n++;
    const st = x.actualStartTime; const prev = seen ? seen.get(x) : "noseen";
    if (prev === undefined) undef++; else if (prev === st) same++; else diff++;
    if (!(st >= 0)) neg++;
    if (x.child) stack.push(x.child);
    if (x.sibling) stack.push(x.sibling);
  }
  return { n, undef, same, diff, neg, hasSeen: Boolean(seen), commits: window.__bbCommits, tallyKeys: Object.keys(window.__bbTally || {}).length, rootIsSame: root === (window.__bbLastRoot || null) };
});
console.log(JSON.stringify(r));
