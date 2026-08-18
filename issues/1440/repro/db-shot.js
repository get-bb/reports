// Usage: dev-browser run db-shot.js  — screenshots current state of the "bb1440" page
const page = await browser.getPage("bb1440");
await page.waitForTimeout(3000);
const p = await saveScreenshot(await page.screenshot(), "1440-current.png");
console.log(p);
const s = await page.snapshotForAI({ track: "main", timeout: 5000 });
console.log(s.full.length, s.full.slice(0, 200));
console.log(await page.evaluate(() => document.querySelector("main")?.innerText?.slice(0, 1500)));
