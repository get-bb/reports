const page = await browser.getPage("main");
await page.keyboard.press("Enter"); // pick "compact" from typeahead
await page.waitForTimeout(500);
await page.keyboard.press("Enter"); // send
await page.waitForTimeout(6000);
const p2 = await saveScreenshot(await page.screenshot(), "1721-after.png");
console.log(p2);
const txt = await page.locator("main, body").first().innerText();
console.log(txt.slice(0, 1200));
