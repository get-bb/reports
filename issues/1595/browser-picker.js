const page = await browser.getPage("main");
await page.setViewportSize({width: 1400, height: 900});
await page.goto("http://localhost:14008/projects/proj_mcn754hcb8", {waitUntil: "networkidle"});
await page.waitForTimeout(3000);
console.log(page.url());
console.log(await page.evaluate(() => document.body.innerText.slice(0, 800)));
await saveScreenshot(await page.screenshot(), "1595-a.png");
// find the environment picker trigger; print buttons
const btns = await page.evaluate(() => [...document.querySelectorAll('button')].map(b => b.innerText.trim()).filter(Boolean).slice(0,40));
console.log(JSON.stringify(btns));
