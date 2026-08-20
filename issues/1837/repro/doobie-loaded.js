// Open the thread, wait for the inline-vis iframe, screenshot the loaded state.
const page = await browser.getPage("bb1837");
await page.setViewport({ width: 1100, height: 900 });
await page.goto("http://localhost:16414/threads/thr_yepw5sn448");
await page.waitForSelector("iframe[title^='inline-vis']", { timeout: 30000 });
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: "/tmp/bb-reports/issues/assets/1837-loaded.png" });
page.url();
