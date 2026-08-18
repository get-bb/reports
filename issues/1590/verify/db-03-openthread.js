const page = await browser.getPage("lan");
await page.goto("http://192.168.4.29:26934/projects/proj_67cuq4v8fc/threads/thr_3q88fks8ry", { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(4000);
console.log(page.url());
console.log(JSON.stringify(await page.evaluate(() => ({origin: location.origin, isSecureContext: window.isSecureContext, navigatorClipboard: typeof navigator.clipboard}))));
console.log(await saveScreenshot(await page.screenshot(), "1590-verify-lan-before.png"));
