// Load the target thread route directly, wait for boot to settle, then install
// the fetch logger (fresh) so subsequent CLI-driven activity is captured.
// Usage: THREAD/PROJECT ids are baked in below; edit for your instance.
const APP = "http://localhost:12041";
const PROJECT = "proj_n5fxzf5g2g";
const THREAD = "thr_72cv9yzesg";
const page = await browser.getPage("bb1302v");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto(`${APP}/projects/${PROJECT}/threads/${THREAD}`, {
  waitUntil: "networkidle",
});
await page.waitForTimeout(4000);
await page.evaluate(() => {
  window.__apiLog = [];
  const orig = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    const method = (init && init.method) || (input && input.method) || "GET";
    const started = performance.now();
    const res = await orig(input, init);
    if (url.includes("/api/")) {
      const clone = res.clone();
      clone
        .text()
        .then((body) => {
          window.__apiLog.push({
            t: Math.round(started),
            ms: Math.round(performance.now() - started),
            method,
            url: url.replace(/^http:\/\/[^/]+/, ""),
            bytes: body.length,
          });
        })
        .catch(() => {});
    }
    return res;
  };
});
await page.waitForTimeout(3000);
console.log(page.url());
console.log("calls in the 3s after install (should be quiet):", JSON.stringify(await page.evaluate(() => window.__apiLog)));
const shot = await page.screenshot();
console.log(await saveScreenshot(shot, "1302-thread-before.png"));
