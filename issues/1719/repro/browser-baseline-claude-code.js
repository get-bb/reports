// dev-browser script: screenshot a native (Claude Code) file_change approval on the base commit.
const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:15048/projects/proj_eyzm33avat/threads/thr_trenkdebtx");
await page.waitForTimeout(6000);
console.log(await saveScreenshot(await page.screenshot(), "1719-baseline.png"));
console.log((await page.evaluate(() => document.body.innerText)).slice(0, 1500));
