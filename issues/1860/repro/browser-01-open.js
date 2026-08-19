const page = await browser.getPage("app");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:16560/", { waitUntil: "networkidle", timeout: 25000 });
await new Promise((r) => setTimeout(r, 2000));
console.log(page.url(), await page.title());
const p = await saveScreenshot(await page.screenshot(), "1860-home.png");
console.log(p);
