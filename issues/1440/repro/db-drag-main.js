// Drag from empty sidebar space upward across the sidebar labels.
const page = await browser.getPage("bb1440");
await page.evaluate(() => window.getSelection().removeAllRanges());
await page.mouse.move(200, 420);
await page.mouse.down();
await page.mouse.move(200, 300, { steps: 6 });
await page.mouse.move(60, 160, { steps: 10 });
await page.mouse.move(30, 60, { steps: 6 });
await page.waitForTimeout(200);
const drag = await page.evaluate(() => window.getSelection().toString());
await saveScreenshot(await page.screenshot(), "1440-drag-sidebar.png");
await page.mouse.up();
console.log("--- selection after dragging from empty sidebar space up over the labels ---");
console.log(JSON.stringify(drag));
