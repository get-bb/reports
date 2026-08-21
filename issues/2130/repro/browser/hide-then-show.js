// Simulate the user switching browser tabs away and back: bring a blank page
// to the front (bb page becomes document.hidden), wait, then bring bb back.
const page = await browser.getPage("bb2130");
const other = await browser.getPage("blank2130");
await other.goto("about:blank");
await other.bringToFront();
await new Promise((r) => setTimeout(r, 1500));
const hiddenState = await page.evaluate(() => document.visibilityState);
await page.bringToFront();
await new Promise((r) => setTimeout(r, 2500));
({ whileAway: hiddenState, now: await page.evaluate(() => document.visibilityState) });
