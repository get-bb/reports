const page = await browser.getPage("main");
await page.setViewportSize({width: 1400, height: 900});
await page.goto("http://localhost:15580/extensions/plugins", {waitUntil: "networkidle"});
await page.waitForTimeout(1500);
await page.getByText("Installed plugins", {exact: true}).first().click();
await page.waitForTimeout(2000);
console.log(page.url());
console.log(await saveScreenshot(await page.screenshot(), "1758-installed.png"));
// open GitHub detail
const row = page.locator('a,button,div[role="button"]', {hasText: /^GitHub/}).first();
console.log("rows", await row.count());
try { await row.click({timeout: 3000}); } catch (e) { console.log("click failed", String(e).slice(0,100)); }
await page.waitForTimeout(2000);
console.log(page.url());
console.log(await saveScreenshot(await page.screenshot(), "1758-detail.png"));
const txt = await page.evaluate(() => document.body.innerText);
console.log(txt.slice(0, 1500));
