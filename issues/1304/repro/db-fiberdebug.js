const CFG = JSON.parse(await readFile("1304-cfg.json"));
const page = await browser.getPage(CFG.pageName);
const r = await page.evaluate(() => {
  const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  const el = document.querySelector('[data-timeline-row-id]');
  const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
  let f = el[key];
  const out = [];
  let i = 0;
  while (f && i < 40) {
    const t = f.type;
    const name = typeof t === "function" ? (t.displayName || t.name) : typeof t === "string" ? t : t && (t.displayName || (t.render && t.render.name) || (t.type && t.type.name)) || String(f.tag);
    out.push([name, f.actualStartTime, f.actualDuration, f.alternate ? f.alternate.actualStartTime : null, f.mode]);
    f = f.return; i++;
  }
  return out;
});
console.log(JSON.stringify(r));
