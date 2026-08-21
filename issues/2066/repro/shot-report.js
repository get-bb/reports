const page = await browser.getPage("r2066");
await page.setViewport({ width: 1000, height: 1400 });
await page.goto("file:///tmp/bb-reports/issues/2066.html");
await page.screenshot({ path: "/tmp/bb-reports/issues/2066/repro/report-preview.png" });
"ok"
