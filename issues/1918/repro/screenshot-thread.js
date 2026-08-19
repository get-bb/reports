const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:12764/projects/proj_dyrddcr27t/threads/thr_gub2gecrgu", {
  waitUntil: "networkidle",
});
await page.waitForTimeout(3000);
console.log(await page.url());
const p = await saveScreenshot(
  await page.screenshot({ fullPage: false }),
  "1918-thread-fixed.png",
);
console.log(p);
const txt = await page.evaluate(() => document.body.innerText);
console.log(txt.slice(0, 1500));
