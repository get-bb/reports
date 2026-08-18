const page = await browser.getPage("bb1670");
await page.goto("http://localhost:12237/projects/proj_2yvd4nxtww", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
console.log(page.url());
const s = await page.snapshotForAI({ track: "main", timeout: 5000 });
console.log(s.full.slice(0, 6000));
