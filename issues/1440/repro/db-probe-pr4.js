// What does Ctrl+A / Ctrl+C actually copy on the PR build? Paste into the prompt editor to find out.
const page = await browser.getPage("bb1440");
async function copyPaste(label) {
  await page.keyboard.press("Control+A");
  await page.waitForTimeout(200);
  const shot = await saveScreenshot(await page.screenshot(), label + ".png");
  await page.keyboard.press("Control+C");
  await page.waitForTimeout(200);
  const editor = page.locator('[contenteditable="true"]').first();
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Delete");
  await page.keyboard.press("Control+V");
  await page.waitForTimeout(500);
  const pasted = await editor.evaluate((el) => el.innerText);
  console.log("--- " + label + " -> pasted text ---");
  console.log(JSON.stringify(pasted));
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Delete");
  await page.evaluate(() => window.getSelection().removeAllRanges());
  console.log(shot);
}
// 1. click empty sidebar space
await page.mouse.click(150, 500);
await copyPaste("1440-pr-ctrl-a-sidebar");
// 2. click inside a message
const box = await page.evaluate(() => {
  const el = [...document.querySelectorAll("body *")].find((n) => n.children.length === 0 && n.textContent.trim().startsWith("Use your shell tool"));
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
await page.mouse.click(box.x + 10, box.y + box.h / 2);
await copyPaste("1440-pr-ctrl-a-message");
