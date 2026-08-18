// dev-browser script: open the QA thread and take a baseline screenshot.
const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:15271/projects/proj_drg6kwky3m/threads/thr_5e4dmaajwp", { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
console.log(await page.title(), page.url());
console.log(await saveScreenshot(await page.screenshot(), "1615-thread.png"));
