// dev-browser script: after typing (page already open), list every fiber on the
// path from a timeline row up to the root, marking context providers whose value
// differs between the current fiber and its alternate (i.e. changed in the last
// re-render of that provider).
const CFG = JSON.parse(await readFile("1304-cfg.json"));
const page = await browser.getPage(CFG.pageName);
const editor = page.locator('[contenteditable="true"][role="textbox"]').last();
await editor.click();
await page.keyboard.type("x");
await page.waitForTimeout(300);
await page.keyboard.type("y");
await page.waitForTimeout(300);
const r = await page.evaluate(() => {
  const el = document.querySelector('[data-timeline-row-id]');
  const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
  let f = el[key];
  const out = [];
  while (f) {
    const t = f.type;
    let name = typeof t === "function" ? (t.displayName || t.name) : typeof t === "string" ? t : t && (t.displayName || (t._context && (t._context.displayName || "ctx")) || (t.render && t.render.name) || (t.type && (t.type.displayName || t.type.name))) || String(f.tag);
    if (f.tag === 10) {
      const ctx = t._context || t;
      const cur = f.memoizedProps && f.memoizedProps.value;
      const alt = f.alternate && f.alternate.memoizedProps ? f.alternate.memoizedProps.value : undefined;
      const changed = f.alternate ? !Object.is(cur, alt) : null;
      let vdesc = typeof cur;
      if (cur && typeof cur === "object") vdesc = "object{" + Object.keys(cur).slice(0, 6).join(",") + "}";
      if (typeof cur === "function") vdesc = "fn:" + (cur.name || "anon");
      out.push({ tag: "Provider", ctx: ctx.displayName || "?", changed, vdesc, start: Math.round(f.actualStartTime), altStart: f.alternate ? Math.round(f.alternate.actualStartTime) : null });
    } else if (typeof t === "function" || (t && typeof t === "object")) {
      out.push({ tag: "C", name, start: Math.round(f.actualStartTime), altStart: f.alternate ? Math.round(f.alternate.actualStartTime) : null });
    }
    f = f.return;
  }
  return out;
});
for (const x of r) console.log(JSON.stringify(x));
