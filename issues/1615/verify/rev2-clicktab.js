const page = await browser.getPage("csv");
const tab = page.getByRole("tab", { name: /big\.csv/ });
console.log("tab count", await tab.count());
const t0 = Date.now();
if (await tab.count()) await tab.first().click();
else await page.getByText("big.csv", { exact: true }).first().click();
try {
  await page.waitForSelector("table[aria-label$='CSV preview']", { timeout: 60000 });
  console.log("table visible after ms", Date.now() - t0);
} catch (e) { console.log("no table:", String(e).slice(0, 200)); }
console.log(await saveScreenshot(await page.screenshot(), "1615-peek.png"));
console.log(await page.evaluate(() => ({ td: document.querySelectorAll("td").length, tabs: Array.from(document.querySelectorAll('[role=tab]')).map(t => t.getAttribute('aria-selected') + ':' + t.textContent) })));
