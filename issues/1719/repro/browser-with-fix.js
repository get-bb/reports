// dev-browser script: screenshot both with-fix threads (patched plugins/provider-acp).
const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:15048/projects/proj_eyzm33avat/threads/thr_eqxyczvh7j");
await page.waitForTimeout(6000);
console.log(await saveScreenshot(await page.screenshot(), "1719-fix-write.png"));
console.log((await page.evaluate(() => document.body.innerText)).slice(0, 900));
await page.goto("http://localhost:15048/projects/proj_eyzm33avat/threads/thr_2wrth8z2e5");
await page.waitForTimeout(6000);
console.log(await saveScreenshot(await page.screenshot(), "1719-fix-extdir.png"));
console.log((await page.evaluate(() => document.body.innerText)).slice(0, 900));
