const page = await browser.getPage("main");
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto("http://localhost:11498/projects/proj_953iq6k6vv/threads/thr_g28r4itw8a", { waitUntil: "load" });
await new Promise(r => setTimeout(r, 6000));
console.log(await page.title(), page.url());
const p = await saveScreenshot(await page.screenshot({ fullPage: false }), "1355-b-collapsed.png");
console.log(p);
