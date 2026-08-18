// Inspect every context Provider fiber on the path from a timeline row up to
// the root after typing two chars: compare value vs alternate value.
const CFG = JSON.parse(await readFile("1304-cfg.json"));
const page = await browser.getPage(CFG.pageName);
const editor = page.locator('[contenteditable="true"][role="textbox"]').last();
await editor.click();
await page.keyboard.type("x"); await page.waitForTimeout(300);
await page.keyboard.type("y"); await page.waitForTimeout(300);
console.log(JSON.stringify(await page.evaluate(() => {
  const el = document.querySelector('[data-timeline-row-id]');
  const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
  let f = el[key];
  const out = [];
  while (f) {
    if (f.tag === 10) {
      const p = f.return; const pname = p && typeof p.type === "function" ? p.type.name : String(p && p.tag);
      const cur = f.memoizedProps && f.memoizedProps.value; const alt = f.alternate && f.alternate.memoizedProps && f.alternate.memoizedProps.value;
      out.push({ parent: pname, same: Object.is(cur, alt), curType: typeof cur, curName: typeof cur === "function" ? cur.name : undefined, altName: typeof alt === "function" ? alt.name : undefined, curSrc: typeof cur === "function" ? String(cur).slice(0, 80) : undefined, altSrc: typeof alt === "function" ? String(alt).slice(0, 80) : undefined, start: f.actualStartTime, altStart: f.alternate && f.alternate.actualStartTime });
    }
    f = f.return;
  }
  return out;
}), null, 1));
