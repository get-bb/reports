// Base build: drag from the empty gutter left of a user message into the message text; Ctrl+A + Ctrl+C.
const page = await browser.getPage("bb1440");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:13365/projects/proj_xp7gwkuyi4/threads/thr_2wxsqrnrwx", { waitUntil: "load" });
await page.waitForTimeout(8000);
await page.evaluate(() => window.getSelection().removeAllRanges());
const box = await page.evaluate(() => {
  const el = [...document.querySelectorAll("body *")].find((n) => n.children.length === 0 && n.textContent.trim().startsWith("Use your shell tool"));
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
console.log("message box", JSON.stringify(box));
await page.mouse.move(box.x - 200, box.y + 8);
await page.mouse.down();
await page.mouse.move(box.x + 300, box.y + 8, { steps: 15 });
await page.waitForTimeout(200);
await saveScreenshot(await page.screenshot(), "1440-gutter-drag.png");
await page.mouse.up();
console.log("--- drag from gutter (200px left of message) into message text ---");
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
await page.mouse.click(box.x + 10, box.y + 8);
await page.keyboard.press("Control+A");
await page.waitForTimeout(200);
console.log("ctrl+a selection toString:", JSON.stringify(await page.evaluate(() => getSelection().toString().slice(0, 300))));
await pasteIntoEditor("Ctrl+A after clicking in message");
