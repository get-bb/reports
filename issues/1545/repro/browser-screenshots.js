const page = await browser.getPage("main");
await page.setViewportSize({width: 1400, height: 900});
await page.goto("http://localhost:12582/projects/proj_df22yte62v/threads/thr_qye8969p6r");
await new Promise(r => setTimeout(r, 7000));
console.log(await saveScreenshot(await page.screenshot(), "1545-agent-shell-volta-error.png"));
await page.goto("http://localhost:12582/projects/proj_df22yte62v/threads/thr_hj9rx8rcb7");
await new Promise(r => setTimeout(r, 7000));
console.log(await saveScreenshot(await page.screenshot(), "1545-agent-shell-after-fix.png"));
