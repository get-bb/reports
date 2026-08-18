const page = await browser.getPage("csv");
console.log(await saveScreenshot(await page.screenshot(), "1615-peek.png"));
console.log(await page.evaluate(() => document.body.innerText.slice(0, 1500)));
