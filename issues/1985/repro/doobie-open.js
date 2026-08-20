const page = await browser.getPage("bb1985");
await page.setViewport({ width: 1500, height: 950 });
await page.goto("http://localhost:14918/threads/thr_pu2wtuaw77");
await new Promise((r) => setTimeout(r, 6000));
await page.screenshot({ path: "/tmp/bb-reports/issues/assets/1985-before.png" });
page.url();
