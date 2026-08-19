const page = await browser.getPage("main");
await page.goto("about:blank");
await page.goto("http://localhost:13806/projects/proj_ks8z3m2awr/threads/thr_mfus3sx7bg");
await page.waitForTimeout(8000);
const p = await saveScreenshot(await page.screenshot(), "1868-d.png");
console.log(p);
const txt = await page.evaluate(() => document.body.innerText);
console.log(txt.split("\n").filter((l) => /Worked for|Loading|Working|Sweep|workflow/i.test(l)).join(" | "));
