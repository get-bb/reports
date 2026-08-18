// dev-browser script: open the bb dev app and list API requests made during boot.
// Usage: dev-browser --headless --timeout 60 run browser-01-open.js
const APP = "http://localhost:15464/";
const page = await browser.getPage("bb1302");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto(APP, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
const entries = await page.evaluate(() =>
  performance
    .getEntriesByType("resource")
    .filter((e) => e.name.includes("/api/"))
    .map((e) => ({
      url: e.name.replace(/^http:\/\/[^/]+/, ""),
      transfer: e.transferSize,
      decoded: e.decodedBodySize,
      t: Math.round(e.startTime),
    })),
);
console.log(JSON.stringify(entries));
console.log(page.url());
