// Print the API calls recorded by the fetch logger since it was (re)set,
// then reset it. Also saves a screenshot.
const page = await browser.getPage("bb1302v");
await page.waitForTimeout(3000);
const log = await page.evaluate(() => window.__apiLog);
const t0 = log.length ? log[0].t : 0;
for (const e of log) {
  console.log(
    `${String(e.t - t0).padStart(6)}ms  ${e.method.padEnd(5)} ${e.url}  -> ${e.bytes} bytes (${e.ms}ms)`,
  );
}
const boot = log.filter((e) => e.url.includes("sidebar-bootstrap"));
console.log(
  `TOTAL api calls: ${log.length}; sidebar-bootstrap calls: ${boot.length}; sidebar-bootstrap bytes: ${boot.reduce((a, b) => a + b.bytes, 0)}; all bytes: ${log.reduce((a, b) => a + b.bytes, 0)}`,
);
await page.evaluate(() => (window.__apiLog.length = 0));
const shot = await page.screenshot();
console.log(await saveScreenshot(shot, "1302-thread-after.png"));
