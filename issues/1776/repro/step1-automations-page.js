// dev-browser script: open the Automations page and list buttons
const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:17447/automations", { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
console.log("url:", page.url());
const p1 = await saveScreenshot(await page.screenshot(), "1776-01-automations-page.png");
console.log(p1);
console.log(JSON.stringify(await page.locator("button").allInnerTexts()));
