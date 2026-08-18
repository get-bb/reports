const CFG = JSON.parse(await readFile("1304-cfg.json"));
const page = await browser.getPage(CFG.pageName);
console.log(page.url());
console.log(await page.evaluate(() => document.body.innerText.slice(0, 1500)));
console.log(await saveScreenshot(await page.screenshot(), "dbg.png"));
