const page = await browser.getPage("main");
const p = await saveScreenshot(await page.screenshot({ clip: { x: 480, y: 690, width: 760, height: 200 } }), "1719-c.png");
console.log(p);
await page.getByRole("button", { name: "Allow once" }).click();
await page.waitForTimeout(5000);
const p2 = await saveScreenshot(await page.screenshot(), "1719-d.png");
console.log(p2);
console.log((await page.evaluate(() => document.body.innerText)).slice(0, 1500));
