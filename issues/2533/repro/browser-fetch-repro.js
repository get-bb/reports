// Run this with doobie against the isolated app URL.
const page = await browser.getPage("sidebar-fetch-repro");
await page.setViewport({ width: 1440, height: 900 });
await page.evaluateOnNewDocument(() => {
  const originalFetch = window.fetch.bind(window);
  const startedAt = Date.now();
  window.__issue2533Requests = [];
  window.fetch = (...args) => {
    const input = args[0];
    const url = typeof input === "string" ? input : input.url;
    const elapsed = Date.now() - startedAt;
    if (url.includes("/api/v1/sidebar-bootstrap")) {
      if (elapsed < 8000) {
        window.__issue2533Requests.push({ result: "fail", elapsed });
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      window.__issue2533Requests.push({ result: "continue", elapsed });
    }
    return originalFetch(...args);
  };
});
await page.goto("http://127.0.0.1:15786/?issue=2533", {
  waitUntil: "domcontentloaded",
  timeout: 15000,
});
await new Promise((resolve) => setTimeout(resolve, 7000));
const firstText = await page.evaluate(() => document.body.innerText);
await new Promise((resolve) => setTimeout(resolve, 6000));
const finalText = await page.evaluate(() => document.body.innerText);
const requests = await page.evaluate(() => window.__issue2533Requests);
({
  requests,
  firstHasError: firstText.includes("Failed to load projects."),
  finalHasError: finalText.includes("Failed to load projects."),
});
