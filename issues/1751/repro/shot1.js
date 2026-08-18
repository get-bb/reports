const page = await browser.getPage("main");
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto("http://localhost:12645/projects/proj_hbmk4b4bdz/threads/thr_6jj3crh5jr", { waitUntil: "load" });
await page.waitForSelector(".bb-code-highlight", { timeout: 30000 }).catch(e => console.log("no highlight:", e.message));
await page.waitForTimeout(2000);
const p = await saveScreenshot(await page.screenshot(), "1751-thread-full.png");
console.log(p);
const els = await page.$$eval(".bb-code-highlight", (nodes) => nodes.map(n => ({html: n.innerHTML.slice(0,200), rect: n.getBoundingClientRect().toJSON()})));
console.log(JSON.stringify(els, null, 1));
