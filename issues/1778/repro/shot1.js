const page = await browser.getPage("bb1778");
await page.setViewport({ width: 1280, height: 1000 });
await page.goto("http://localhost:18548/projects/proj_x3nfvqf5v4/threads/thr_x9gvs6bkf5");
await page.waitForSelector(".katex-error, .katex", { timeout: 30000 });
await new Promise((r) => setTimeout(r, 2000));
await page.screenshot({ path: "/tmp/bb-reports/issues/assets/1778-thread-overview.png" });
const info = await page.evaluate(() => {
  const err = document.querySelector(".katex-error");
  const h2s = [...document.querySelectorAll("[data-markdown-preview] h2")].map((h) => h.textContent);
  return {
    url: location.href,
    errorLen: err ? err.textContent.length : null,
    errorTitle: err ? err.getAttribute("title") : null,
    errorText: err ? err.textContent.slice(0, 400) : null,
    h2s,
    katexDisplay: !!document.querySelector(".katex-display"),
  };
});
info;
