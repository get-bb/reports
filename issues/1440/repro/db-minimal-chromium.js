// Minimal Chromium check, independent of bb: body { user-select:none } + island { user-select:text }.
// Q1: does Select All copy the island text? Q2: does a drag that starts on the none area select island text?
const page = await browser.newPage();
await page.setContent(`<!doctype html><html><body style="user-select:none;margin:0;font:16px sans-serif">
<div id="chrome" style="height:80px;background:#eee">chrome label</div>
<div style="padding:20px 200px"><div id="island" style="user-select:text;background:#dfd">island content text</div></div>
<textarea id="ta" style="margin-top:40px"></textarea>
</body></html>`);
await page.mouse.click(300, 40);
await page.keyboard.press("Control+A");
console.log("SelectAll toString:", JSON.stringify(await page.evaluate(() => getSelection().toString())));
await page.keyboard.press("Control+C");
await page.click("#ta");
await page.keyboard.press("Control+V");
console.log("SelectAll -> clipboard pasted into textarea:", JSON.stringify(await page.evaluate(() => document.getElementById("ta").value)));
await page.evaluate(() => { document.getElementById("ta").value = ""; getSelection().removeAllRanges(); });
const r = await page.evaluate(() => { const b = document.getElementById("island").getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
await page.mouse.move(r.x - 100, r.y + r.h / 2);
await page.mouse.down();
await page.mouse.move(r.x + r.w, r.y + r.h / 2, { steps: 10 });
await page.mouse.up();
console.log("drag from none-area into island:", JSON.stringify(await page.evaluate(() => getSelection().toString())));
await page.evaluate(() => getSelection().removeAllRanges());
await page.mouse.move(r.x + 2, r.y + r.h / 2);
await page.mouse.down();
await page.mouse.move(r.x + r.w, r.y + r.h / 2, { steps: 10 });
await page.mouse.up();
console.log("drag starting inside island:", JSON.stringify(await page.evaluate(() => getSelection().toString())));
console.log("UA:", await page.evaluate(() => navigator.userAgent));
