// dev-browser script: open a thread page and dump render counters.
const page = await browser.getPage("bb1304");
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto("http://localhost:16550/projects/proj_rgsz9s6cf9/threads/thr_7pjwqvvat2", { waitUntil: "load" });
await page.waitForTimeout(6000);
console.log(await page.title(), page.url());
console.log(JSON.stringify(await page.evaluate(() => window.__bbRenderCounts)));
const shot = await page.screenshot();
console.log(await saveScreenshot(shot, "1304-first.png"));
