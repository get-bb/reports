const page = await browser.getPage("main");
const errs = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") errs.push(m.type() + ": " + m.text().slice(0, 300));
});
page.on("pageerror", (e) => errs.push("pageerror: " + String(e).slice(0, 300)));
await page.reload();
await page.waitForTimeout(15000);
const p = await saveScreenshot(await page.screenshot(), "1868-b.png");
console.log(p);
const txt = await page.evaluate(() => document.body.innerText);
console.log(txt.slice(0, 2500));
console.log(errs.join("\n"));
