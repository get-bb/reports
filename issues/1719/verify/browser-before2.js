const page = await browser.getPage("main");
await page.waitForTimeout(8000);
const p = await saveScreenshot(await page.screenshot(), "v1719-before2.png");
console.log(p);
const t = await page.evaluate(() => document.body.innerText);
console.log(t.slice(0, 2500));
