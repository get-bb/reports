const page = await browser.getPage("main");
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto("http://localhost:15448/projects/proj_yywightpbu/threads/thr_y9kzrqugz5");
await page.waitForTimeout(12000);
const p = await saveScreenshot(await page.screenshot(), "1868-verify-app.png");
console.log(p);
const txt = await page.evaluate(() => document.body.innerText);
console.log(txt.split("\n").filter((l) => /Worked for|Loading|Working|Sweep|workflow/i.test(l)).join(" | "));
