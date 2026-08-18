const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:15040/", { waitUntil: "load" });
await page.waitForTimeout(6000);
console.log(await page.title(), await page.evaluate(() => document.querySelectorAll("*").length), page.url());
