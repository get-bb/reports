const page = await browser.getPage("main");
console.log(await page.evaluate(() => navigator.userAgent));
