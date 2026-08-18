// dev-browser script: open data/big.csv (600 rows x 120 cols) in the
// secondary-panel file preview and count the table cells the CSV preview
// creates for a panel that shows ~35 rows.
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:15040/projects/proj_uy6nvf8nfy/threads/thr_pm9wxhqkwb", { waitUntil: "load" });
await page.waitForTimeout(8000);
if (!(await page.getByRole("button", { name: /Hide right panel/ }).count())) {
  await page.getByRole("button", { name: /Show right panel/ }).click();
  await page.waitForTimeout(800);
}
await page.getByRole("button", { name: /New tab/i }).first().click();
await page.waitForTimeout(600);
const search = page.getByPlaceholder("Search files");
await search.fill("big.csv");
await page.waitForTimeout(1500);
console.log(await saveScreenshot(await page.screenshot(), "1615-verify-csv-search.png"));
const before = await page.evaluate(() => ({ nodes: document.querySelectorAll("*").length, tds: document.querySelectorAll("td").length }));
console.log("before opening csv:", JSON.stringify(before));
const t0 = Date.now();
await search.press("Enter");
await page.waitForSelector("table[aria-label$='CSV preview']", { timeout: 120000 });
const t1 = Date.now();
await page.waitForTimeout(1500);
const stats = await page.evaluate(() => {
  const table = document.querySelector("table[aria-label$='CSV preview']");
  const scroller = table.parentElement;
  const rect = scroller.getBoundingClientRect();
  return {
    totalNodes: document.querySelectorAll("*").length,
    tableNodes: table.querySelectorAll("*").length,
    td: table.querySelectorAll("td").length,
    th: table.querySelectorAll("th").length,
    bodyRows: table.querySelectorAll("tbody tr").length,
    columns: table.querySelectorAll("thead th").length - 1,
    scrollBox: { w: Math.round(rect.width), h: Math.round(rect.height) },
    scrollSize: { w: scroller.scrollWidth, h: scroller.scrollHeight },
    note: (document.body.innerText.match(/Showing the first[^\n]*/) || [""])[0],
  };
});
console.log("csv preview:", JSON.stringify(stats)); await writeFile("step4.verify.json", JSON.stringify(stats));
console.log("ms from Enter to table in DOM:", t1 - t0);
console.log(await saveScreenshot(await page.screenshot(), "1615-verify-csv-preview.png"));
