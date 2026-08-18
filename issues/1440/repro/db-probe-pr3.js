// Expand "Worked for" group, inspect tool output selectability; verify caret placement before Ctrl+A.
const page = await browser.getPage("bb1440");
await page.evaluate(() => window.getSelection().removeAllRanges());
const box = await page.evaluate(() => {
  const el = [...document.querySelectorAll("body *")].find((n) => n.children.length === 0 && n.textContent.trim().startsWith("Use your shell tool"));
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
await page.mouse.click(box.x + 10, box.y + box.h / 2);
console.log("--- selection after click in message ---");
console.log(JSON.stringify(await page.evaluate(() => { const s = getSelection(); return { rangeCount: s.rangeCount, type: s.type, anchor: s.anchorNode && s.anchorNode.textContent.slice(0, 40), offset: s.anchorOffset, active: document.activeElement.tagName }; })));
await page.keyboard.press("Control+A");
await page.waitForTimeout(200);
console.log("--- after Ctrl+A ---");
console.log(JSON.stringify(await page.evaluate(() => { const s = getSelection(); return { rangeCount: s.rangeCount, type: s.type, text: s.toString().slice(0, 200) }; })));

// expand the last "Worked for" group
const workedFor = page.getByText(/Worked for/).last();
await workedFor.click({ timeout: 5000 });
await page.waitForTimeout(1500);
const rows = await page.evaluate(() => {
  return [...document.querySelectorAll("main *")]
    .filter((n) => n.children.length === 0 && /hello-1440|README|echo|Ran|\$ /.test(n.textContent))
    .map((n) => ({ tag: n.tagName, text: n.textContent.slice(0, 100), us: getComputedStyle(n).userSelect, inButton: !!n.closest("button") }));
});
console.log("--- tool call rows after expanding ---");
console.log(JSON.stringify(rows, null, 2));
await saveScreenshot(await page.screenshot(), "1440-pr-expanded.png");
