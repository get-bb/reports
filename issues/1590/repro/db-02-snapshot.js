const page = await browser.getPage("lan");
const shot = await saveScreenshot(await page.screenshot(), "1590-lan-before.png");
console.log(shot);
const r = await page.snapshotForAI({ track: "lan", timeout: 5000 });
const lines = r.full.split("\n").filter((l) => /copy|Copy|button/i.test(l));
console.log(lines.slice(0, 80).join("\n"));
