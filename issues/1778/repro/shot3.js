const page = await browser.getPage("bb1778");
await page.goto("http://localhost:18548/projects/proj_x3nfvqf5v4/threads/thr_x9gvs6bkf5");
await page.waitForSelector(".katex-display", { timeout: 30000 });
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: "/tmp/bb-reports/issues/assets/1778-expected-canonical-form.png" });
await page.evaluate(() => ({
  katexDisplay: document.querySelectorAll(".katex-display").length,
  h2s: [...document.querySelectorAll("[data-markdown-preview] h2")].map((h) => h.textContent),
  errors: document.querySelectorAll(".katex-error").length,
}));
