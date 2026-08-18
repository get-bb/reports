const page = await browser.getPage("main");
await page.setViewportSize({width: 1280, height: 900});
await page.goto("http://localhost:12022/settings/machines", {waitUntil: "networkidle"});
await new Promise(r=>setTimeout(r,3000));
console.log(await page.url());
console.log(await saveScreenshot(await page.screenshot(), "1690-a.png"));
const btns = await page.$$eval("button", els => els.map(e=>e.textContent.trim()).filter(Boolean));
console.log(JSON.stringify(btns));
