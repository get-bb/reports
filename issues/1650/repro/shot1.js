const page = await browser.getPage("main");
page.on("console", m => { if (m.type()==="error") console.log("CONSOLE:", m.text().slice(0,200)); });
await page.reload();
await page.waitForTimeout(12000);
console.log(await saveScreenshot(await page.screenshot(), "1650-blocked.png"));
console.log((await page.innerText("body")).slice(0,600));
