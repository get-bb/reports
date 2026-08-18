const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:11590/projects/proj_bsst4jxfwv", { waitUntil: "networkidle" });
await new Promise((r) => setTimeout(r, 4000));
const p = await saveScreenshot(await page.screenshot(), "1648-app-thread-titles.png");
console.log(p);
console.log((await page.evaluate(() => document.body.innerText)).slice(0, 1500));
