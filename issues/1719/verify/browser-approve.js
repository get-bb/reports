const page = await browser.getPage("main");
await page.getByRole("button", { name: "Allow once" }).click();
await page.waitForTimeout(6000);
const p2 = await saveScreenshot(await page.screenshot(), "v1719-after.png");
console.log(p2);
console.log((await page.evaluate(() => document.body.innerText)).slice(0, 1500));
