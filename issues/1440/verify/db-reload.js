const page = await browser.getPage("v1440");
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(8000);
console.log(page.url());
const s = await page.snapshotForAI({ track: "main", timeout: 5000 });
console.log(s.full.slice(3000, 8000));
