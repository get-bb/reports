const page = await browser.getPage("main");
await page.setViewportSize({width: 1400, height: 900});
await page.goto("http://localhost:15580/", {waitUntil: "networkidle"});
await page.waitForTimeout(2000);
console.log(await page.title(), page.url());
console.log(await saveScreenshot(await page.screenshot(), "1758-home.png"));
