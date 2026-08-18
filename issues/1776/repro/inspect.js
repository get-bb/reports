const page = await browser.getPage("main2");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:17447/", { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
console.log(page.url());
await saveScreenshot(await page.screenshot(), "1776-inspect.png");
console.log(await page.evaluate(() => document.body.innerText.slice(0, 500)));
console.log(await page.evaluate(() => [...document.querySelectorAll('textarea, [contenteditable], [role="textbox"]')].length));
