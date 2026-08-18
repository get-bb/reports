const page = await browser.getPage("main");
await page.goto("http://localhost:16802/projects/proj_vp9rypyfbf/threads/thr_gvgz7qwcd9");
await page.waitForTimeout(8000);
const p = await saveScreenshot(await page.screenshot(), "1719-e.png");
console.log(p);
console.log((await page.evaluate(() => document.body.innerText)).slice(0, 1200));
