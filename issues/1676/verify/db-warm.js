const page = await browser.getPage("bb");
await page.setViewportSize({width: 1280, height: 800});
await page.goto("http://localhost:12312/", {waitUntil: "networkidle"});
await page.waitForTimeout(3000);
console.log(page.url());
const p = await saveScreenshot(await page.screenshot(), "1676-home-warm.png");
console.log(p);
console.log((await page.evaluate(() => document.body.innerText)).slice(0, 1500));
