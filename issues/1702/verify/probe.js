const page = await browser.getPage("main");
await page.goto("http://localhost:13543/plugins/tasks/tasks/01M0A05KVENPMP0YNGF9EBMK7B", { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(15000);
console.log(page.url(), await page.title());
console.log((await page.locator('button[aria-pressed]').allTextContents()));
console.log((await page.locator('body').innerText()).slice(0,800));
await page.screenshot({path:"/tmp/bb-reports/issues/1702/verify/probe.png"});
