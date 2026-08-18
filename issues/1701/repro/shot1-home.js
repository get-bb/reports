const page = await browser.getPage("main");
await page.setViewportSize({width: 1400, height: 900});
await page.goto("http://localhost:18366/");
await page.waitForTimeout(5000);
console.log(await page.title(), page.url());
const links = await page.evaluate(() => Array.from(document.querySelectorAll('a')).map(a => a.getAttribute('href')).filter(Boolean).slice(0,80));
console.log(JSON.stringify(links));
await saveScreenshot(await page.screenshot(), "1701-home.png");
