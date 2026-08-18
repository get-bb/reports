const page = await browser.getPage("main");
await page.reload();
await page.waitForTimeout(10000);
console.log(await saveScreenshot(await page.screenshot(), "1650-after-answer.png"));
