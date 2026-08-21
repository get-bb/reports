const page = await browser.getPage("report2130");
await page.setViewport({ width: 1100, height: 1400 });
await page.goto("file:///tmp/bb-reports/issues/2130.html");
await new Promise((r) => setTimeout(r, 1000));
await page.screenshot({ path: "/tmp/bb-reports/issues/2130/logs/report-render.png" });
const broken = await page.evaluate(() =>
  Array.from(document.images).filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.getAttribute("src")),
);
({ title: await page.title(), brokenImages: broken });
