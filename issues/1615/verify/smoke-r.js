const page = await browser.getPage("banner");
await page.goto("http://localhost:18434/projects/proj_t95uiuqjap/threads/thr_79bfrk39ug", { waitUntil: "load" });
await page.waitForTimeout(8000);
console.log(await page.evaluate(() => document.querySelectorAll("*").length), await page.title());
console.log(await saveScreenshot(await page.screenshot(), "1615-r-smoke.png"));
console.log((await page.evaluate(() => document.body.innerText)).slice(0,600));
