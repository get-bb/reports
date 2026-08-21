const page = await browser.getPage("r2066");
await page.setViewport({ width: 880, height: 580 });
await page.goto("file:///tmp/bb-reports/issues/assets/2066-heap.svg");
await page.screenshot({ path: "/tmp/bb-reports/issues/2066/repro/heap-chart-preview.png" });
"ok"
