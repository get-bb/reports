const page = await browser.getPage("bb1833");
await page.setViewport({ width: 1400, height: 900 });
await page.goto("http://localhost:14875/projects/proj_thd6gcvyyy/threads/thr_wgnhm8hhpy");
await page.waitForFunction(
  () => document.body.innerText.includes("session/fork"),
  { timeout: 40000 },
);
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({
  path: "/tmp/bb-reports/issues/assets/1833-forked-thread-error.png",
});
page.url();
