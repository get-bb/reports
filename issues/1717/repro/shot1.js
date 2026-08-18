// dev-browser script: screenshot one bb thread page. Placeholders replaced by sed.
const page = await browser.getPage("bb1717");
await page.setViewportSize({ width: 1400, height: 1000 });
await page.goto("http://localhost:12696/projects/proj_ifvzspade5/threads/__ID__");
await new Promise((r) => setTimeout(r, 9000));
console.log(await saveScreenshot(await page.screenshot({ fullPage: false }), "__NAME__"));
