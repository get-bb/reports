// Install a fetch logger on the already-loaded app page. Records every
// /api/ call with timestamp and response byte length into window.__apiLog.
// Usage: dev-browser --headless run browser-03-install-logger.js
const page = await browser.getPage("bb1302");
await page.evaluate(() => {
  if (window.__apiLog) {
    window.__apiLog.length = 0;
    return;
  }
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
console.log(
  "logger installed; fetch is native?",
  await page.evaluate(() => window.fetch.toString().includes("native code")),
);
