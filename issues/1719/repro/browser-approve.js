// dev-browser script: crop the approval card, click Allow once, screenshot after.
const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:15048/projects/proj_eyzm33avat/threads/thr_aqrjgmjtqa");
await page.waitForTimeout(6000);
console.log(await saveScreenshot(await page.screenshot({ clip: { x: 480, y: 690, width: 760, height: 200 } }), "1719-c.png"));
await page.getByRole("button", { name: "Allow once" }).click();
await page.waitForTimeout(5000);
console.log(await saveScreenshot(await page.screenshot(), "1719-d.png"));
console.log((await page.evaluate(() => document.body.innerText)).slice(0, 1500));
