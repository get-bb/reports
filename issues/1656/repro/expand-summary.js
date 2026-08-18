// dev-browser script: click the second "Worked for" summary row and screenshot.
const page = await browser.getPage("main");
await page.setViewportSize({ width: 1280, height: 1100 });
await page.goto("http://localhost:11579/projects/proj_haaz26xrzy/threads/thr_3qxpfum5zs");
await page.waitForTimeout(6000);
const rows = page.locator("text=/^Worked for/");
console.log("worked-for rows:", await rows.count());
await rows.nth(1).click();
await page.waitForTimeout(1500);
const t = await page.evaluate(() => document.body.innerText);
const idx = t.indexOf("issue 1656 repro 4\n\n");
console.log(t.slice(idx).replace(/\n{2,}/g, "\n").slice(0, 1600));
console.log(await saveScreenshot(await page.screenshot({ fullPage: false }), "1656-completed-expanded.png"));
