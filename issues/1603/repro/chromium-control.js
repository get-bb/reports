// dev-browser script: Chromium control at iPhone 8 Plus viewport against the prod app.
// Usage: dev-browser --headless run chromium-control.js  (edit URL below if needed)
const page = await browser.getPage("i1603");
await page.setViewportSize({ width: 414, height: 736 });
await page.goto("http://localhost:45031/", { waitUntil: "load" });
await page.waitForTimeout(6000);
const txt = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 200));
console.log(txt);
console.log(await saveScreenshot(await page.screenshot(), "1603-chromium-prod-settled.png"));
