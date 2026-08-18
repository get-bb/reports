const page = await browser.getPage("lan");
await page.goto(
  "http://192.168.4.29:26106/projects/proj_nu5jy7nj4y/threads/thr_eumrti6rv5",
  { waitUntil: "load", timeout: 30000 },
);
await page.waitForTimeout(4000);
console.log(page.url());
const shot = await saveScreenshot(await page.screenshot(), "1590-lan-thread.png");
console.log(shot);
const r = await page.snapshotForAI({ track: "lan", timeout: 5000 });
const lines = r.full.split("\n").filter((l) => /copy|Copy/i.test(l));
console.log(lines.slice(0, 40).join("\n"));
