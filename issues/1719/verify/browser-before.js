const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:18882/projects/proj_c98btsqs2p/threads/thr_49qrmgzq8x");
await page.waitForTimeout(3000);
const p = await saveScreenshot(await page.screenshot(), "v1719-before.png");
console.log(p);
const t = await page.evaluate(() => document.body.innerText);
console.log(t.slice(0, 2500));
