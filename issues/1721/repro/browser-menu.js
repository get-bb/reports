const page = await browser.getPage("main");
const acts = page.getByRole("button", {name: "Thread actions"});
console.log(await acts.count());
await acts.nth(1).click();
await page.waitForTimeout(800);
const items = await page.$$eval('[role="menuitem"]', ms => ms.map(m => m.textContent.trim()));
console.log(JSON.stringify(items));
const p = await saveScreenshot(await page.screenshot(), "1721-menu.png");
console.log(p);
