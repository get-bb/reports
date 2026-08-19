const page = await browser.getPage("bb1915");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:14376/", { waitUntil: "load" });
await page.waitForTimeout(3000);
console.log(await page.title(), page.url());
await saveScreenshot(await page.screenshot(), "1915-home-before.png");
await page.goto("http://localhost:14376/extensions/plugins", {
  waitUntil: "load",
});
await page.waitForTimeout(3000);
console.log(page.url());
await saveScreenshot(await page.screenshot(), "1915-plugins-before.png");
