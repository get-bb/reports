// Harness check: drag-select inside a message, Ctrl+C, paste into the editor.
// Then Ctrl+A from the message and copy. Works on base and PR builds.
const page = await browser.getPage("bb1440");
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
  console.log(JSON.stringify(pasted));
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Delete");
  await page.evaluate(() => window.getSelection().removeAllRanges());
}
const box = await page.evaluate(() => {
  const el = [...document.querySelectorAll("body *")].find((n) => n.children.length === 0 && n.textContent.trim().startsWith("Use your shell tool"));
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
await page.mouse.move(box.x + 5, box.y + 8);
await page.mouse.down();
await page.mouse.move(box.x + 300, box.y + 8, { steps: 10 });
await page.mouse.up();
console.log("drag selection toString:", JSON.stringify(await page.evaluate(() => getSelection().toString())));
await pasteIntoEditor("drag inside message");

await page.mouse.click(box.x + 10, box.y + 8);
await page.keyboard.press("Control+A");
await page.waitForTimeout(200);
console.log("ctrl+a selection toString:", JSON.stringify(await page.evaluate(() => getSelection().toString().slice(0, 300))));
await pasteIntoEditor("Ctrl+A after clicking in message");

await page.mouse.click(150, 500);
await page.keyboard.press("Control+A");
await page.waitForTimeout(200);
console.log("ctrl+a (sidebar) selection toString:", JSON.stringify(await page.evaluate(() => getSelection().toString().slice(0, 300))));
await pasteIntoEditor("Ctrl+A after clicking empty sidebar");
