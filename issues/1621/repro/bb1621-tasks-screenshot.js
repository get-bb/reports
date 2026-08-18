// dev-browser script: open the tasks panel of the dev app, click the "1621 repro" task,
// screenshot the detail (the em-dash-named image attachment renders as a broken image).
// Usage: APP_URL is baked in; edit the port. Run: dev-browser run bb1621-tasks-screenshot.js
const APP_URL = "http://localhost:14837";
const page = await browser.getPage("main");
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(`${APP_URL}/plugins/tasks/tasks`);
await new Promise((r) => setTimeout(r, 6000));
console.log(await page.url());
// second task row in the "Backlog" group (Q1621-2, the one with attachments)
await page.mouse.click(700, 215);
await new Promise((r) => setTimeout(r, 4000));
console.log(await page.url());
const buf = await page.screenshot({ fullPage: false });
await saveScreenshot(buf, "1621-tasks-broken-attachment.png");
