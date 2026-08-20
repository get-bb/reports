const page = await browser.getPage("v1985");
await page.setViewport({ width: 1500, height: 950 });
await page.goto("http://localhost:13428/threads/thr_rmu5x9s8eq");
await new Promise((r) => setTimeout(r, 8000));
await page.screenshot({ path: "/tmp/bb-reports/issues/1985/verify/before.png" });
page.url();
