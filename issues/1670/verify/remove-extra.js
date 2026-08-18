const page = await browser.getPage("bb1670v");
const btns = page.locator('button[aria-label*="emove"]');
console.log("remove buttons:", await btns.count());
if ((await btns.count()) > 1) await btns.first().click();
await page.waitForTimeout(1000);
const imgs = await page.evaluate(() =>
  Array.from(document.querySelectorAll("img"))
    .filter((i) => /attachments\/content/.test(i.src))
    .map((i) => i.src),
);
console.log(JSON.stringify(imgs));
