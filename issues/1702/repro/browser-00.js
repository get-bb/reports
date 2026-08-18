const page = await browser.getPage("main");
await page.setViewportSize({width:1400,height:900});
await page.goto("http://localhost:14761/plugins/tasks/tasks/all", {waitUntil:"networkidle"});
await page.waitForTimeout(2000);
console.log(page.url());
console.log((await page.innerText("body")).slice(0,1500));
await saveScreenshot(await page.screenshot(), "1702-a.png");
