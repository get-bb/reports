const page = await browser.getPage("v1440");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:15864/projects/proj_4cdzstmt37/threads/thr_qdc592e63q", { waitUntil: "load" });
await page.waitForTimeout(6000);
console.log(page.url());
const s = await page.snapshotForAI({ track: "main", timeout: 5000 });
console.log(s.full.slice(0, 5000));
