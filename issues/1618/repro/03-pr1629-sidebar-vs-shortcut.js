const page = await browser.getPage("main");
await page.setViewportSize({width: 1400, height: 900});
await page.goto("http://localhost:18907/");
await page.waitForTimeout(3000);
// Reset composer preference to Beta.
await page.evaluate(() => localStorage.setItem("bb.root-compose.project-id", "proj_d45ubiyhnd"));
await page.goto("http://localhost:18907/projects/proj_j7n7ute45x/threads/thr_p4ditwufhh");
await page.waitForTimeout(3000);
console.log("thread url:", page.url());
// (a) sidebar "New thread" button
await page.getByRole("button", {name: /^New thread/}).first().click();
await page.waitForTimeout(1500);
let trigger = page.locator("[data-promptbox-project-control]").first();
console.log("after sidebar button click -> url:", page.url(), "composer project:", (await trigger.innerText()).replace(/\n/g, " | "));
await saveScreenshot(await page.screenshot(), "1618-04-pr-sidebar-button.png");
// back to thread, then (b) keyboard shortcut
await page.goto("http://localhost:18907/projects/proj_j7n7ute45x/threads/thr_p4ditwufhh");
await page.waitForTimeout(2500);
await page.keyboard.press("Control+Shift+O");
await page.waitForTimeout(1500);
trigger = page.locator("[data-promptbox-project-control]").first();
console.log("after shortcut -> url:", page.url(), "composer project:", (await trigger.innerText()).replace(/\n/g, " | "));
console.log("stored:", await page.evaluate(() => localStorage.getItem("bb.root-compose.project-id")));
await saveScreenshot(await page.screenshot(), "1618-05-pr-shortcut.png");
