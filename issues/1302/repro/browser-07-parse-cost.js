// Measure JSON.parse cost of the sidebar-bootstrap payload inside the app page,
// with and without 6x CPU throttling (approximating a mid-range phone).
const page = await browser.getPage("bb1302");
const cdp = await page.context().newCDPSession(page);
async function measure() {
  return page.evaluate(async () => {
    const res = await fetch("http://localhost:23464/api/v1/sidebar-bootstrap");
    const text = await res.text();
    const runs = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      JSON.parse(text);
      runs.push(performance.now() - t0);
    }
    runs.sort((a, b) => a - b);
    return { bytes: text.length, medianParseMs: +runs[10].toFixed(2), maxParseMs: +runs[19].toFixed(2) };
  });
}
console.log("no throttle:", JSON.stringify(await measure()));
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
console.log("6x cpu throttle:", JSON.stringify(await measure()));
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
