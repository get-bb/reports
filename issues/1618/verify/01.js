const page = await browser.getPage("main");
await page.goto("http://localhost:18386/");
await page.waitForTimeout(2500);
// The empty root only shows the composer once you start composing.
await page.getByRole("button", {name: "New thread"}).first().click();
await page.waitForTimeout(1500);
const trigger = page.locator("[data-promptbox-project-control]").first();
console.log("trigger before:", (await trigger.innerText()).replace(/\n/g, " | "));
await trigger.click();
await page.waitForTimeout(800);
await saveScreenshot(await page.screenshot(), "1618-verify-picker-open.png");
await page.getByRole("menuitem", {name: "Beta"}).click();
await page.waitForTimeout(1200);
console.log("trigger after:", (await trigger.innerText()).replace(/\n/g, " | "));
console.log("stored:", await page.evaluate(() => localStorage.getItem("bb.root-compose.project-id")));
await saveScreenshot(await page.screenshot(), "1618-verify-01-composer-beta.png");
