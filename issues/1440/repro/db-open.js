const page = await browser.getPage("bb1440");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:13365/projects/proj_xp7gwkuyi4/threads/thr_2wxsqrnrwx", { waitUntil: "load" });
await page.waitForTimeout(6000);
console.log(page.url());
const s = await page.snapshotForAI({ track: "main", timeout: 5000 });
console.log(s.full.slice(0, 5000));
