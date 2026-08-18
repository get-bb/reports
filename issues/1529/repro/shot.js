const page = await browser.getPage("bb1529");
await page.setViewportSize({ width: 1400, height: 1000 });
await page.goto("http://localhost:12031/projects/proj_tau8244si4/threads/thr_pvxfiskgsx");
await new Promise((r) => setTimeout(r, 6000));
console.log(await page.title());
console.log(await page.url());
const p1 = await saveScreenshot(await page.screenshot({ fullPage: false }), "1529-thread-top.png");
console.log(p1);
// scroll to bottom to show the report
await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll("*")).filter((e) => e.scrollHeight > e.clientHeight + 50 && getComputedStyle(e).overflowY !== "visible");
  for (const e of els) e.scrollTop = e.scrollHeight;
});
await new Promise((r) => setTimeout(r, 1500));
const p2 = await saveScreenshot(await page.screenshot({ fullPage: false }), "1529-thread-bottom.png");
console.log(p2);
