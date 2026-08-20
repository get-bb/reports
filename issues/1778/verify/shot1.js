const page = await browser.getPage("bb1778v");
await page.setViewport({ width: 1280, height: 1000 });
await page.goto("http://localhost:18426/projects/proj_d6ckfmpcvw/threads/thr_8j7yezeh5j");
await page.waitForSelector(".katex-error, .katex", { timeout: 30000 });
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: "/tmp/bb-reports/issues/1778/verify/verify-thread-overview.png" });
const info = await page.evaluate(() => {
  const errs = [...document.querySelectorAll(".katex-error")];
  const h2s = [...document.querySelectorAll("h2")].map((h) => h.textContent);
  return {
    url: location.href,
    errCount: errs.length,
    errorTexts: errs.map((e) => e.textContent.slice(0, 200)),
    h2s,
    lis: document.querySelectorAll("li").length,
    katexDisplay: !!document.querySelector(".katex-display"),
  };
});
info;
