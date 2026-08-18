const page = await browser.getPage("main");
await page.goto("http://localhost:14764/projects/proj_smvrtcnbe4/threads/thr_3djzm7bexf");
await new Promise(r=>setTimeout(r,8000));
console.log(page.url());
await saveScreenshot(await page.screenshot(), "1711-parent.png");
