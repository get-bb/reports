// PR build probe: gutter drag, Ctrl+A from message + Ctrl+C, Ctrl+A from sidebar.
const page = await browser.getPage("v1440");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:15864/projects/proj_4cdzstmt37/threads/thr_qdc592e63q", { waitUntil: "load" });
await page.waitForTimeout(9000);
console.log("bodyUserSelect:", await page.evaluate(() => getComputedStyle(document.body).userSelect));
await page.evaluate(() => window.getSelection().removeAllRanges());
const box = await page.evaluate(() => {
  const el = [...document.querySelectorAll("body *")].find((n) => n.children.length === 0 && n.textContent.trim().startsWith("Reply only with ok"));
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height, us: getComputedStyle(el).userSelect };
});
console.log("message box", JSON.stringify(box));
await page.mouse.move(box.x - 200, box.y + 8);
await page.mouse.down();
await page.mouse.move(box.x + box.w - 5, box.y + 8, { steps: 15 });
await page.waitForTimeout(200);
await saveScreenshot(await page.screenshot(), "1440-verify-gutter-drag.png");
await page.mouse.up();
console.log("--- drag from gutter (200px left of message) into message text ---");
console.log(JSON.stringify(await page.evaluate(() => getSelection().toString())));
await page.evaluate(() => window.getSelection().removeAllRanges());
await page.mouse.move(box.x + 3, box.y + 8);
await page.mouse.down();
await page.mouse.move(box.x + box.w - 5, box.y + 8, { steps: 15 });
await page.mouse.up();
console.log("--- drag starting inside message ---");
console.log(JSON.stringify(await page.evaluate(() => getSelection().toString())));

async function pasteIntoEditor(label) {
  await page.keyboard.press("Control+C");
  await page.waitForTimeout(200);
  const editor = page.locator('[contenteditable="true"]').first();
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Delete");
  await page.keyboard.press("Control+V");
  await page.waitForTimeout(500);
  const pasted = await editor.evaluate((el) => el.innerText);
  console.log("--- " + label + " -> clipboard text (pasted into editor) ---");
  console.log(JSON.stringify(pasted.slice(0, 400)));
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Delete");
  await page.evaluate(() => window.getSelection().removeAllRanges());
}
// seed clipboard with a sentinel
await page.evaluate(() => window.getSelection().removeAllRanges());
await page.mouse.move(box.x + 3, box.y + 8);
await page.mouse.down();
await page.mouse.move(box.x + 40, box.y + 8, { steps: 5 });
await page.mouse.up();
await pasteIntoEditor("sentinel drag (partial message)");

await page.mouse.click(box.x + 10, box.y + 8);
await page.keyboard.press("Control+A");
await page.waitForTimeout(200);
console.log("ctrl+a selection:", JSON.stringify(await page.evaluate(() => { const s = getSelection(); return { type: s.type, text: s.toString().slice(0, 300) }; })));
await saveScreenshot(await page.screenshot(), "1440-verify-pr-ctrl-a.png");
await pasteIntoEditor("Ctrl+A after clicking in message");

await page.mouse.click(150, 500);
await page.keyboard.press("Control+A");
await page.waitForTimeout(200);
console.log("ctrl+a (sidebar) selection toString:", JSON.stringify(await page.evaluate(() => getSelection().toString().slice(0, 300))));
