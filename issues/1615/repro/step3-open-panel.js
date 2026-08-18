const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:15271/projects/proj_drg6kwky3m/threads/thr_5e4dmaajwp", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.getByRole("button", { name: /Show right panel/ }).click();
await page.waitForTimeout(1500);
console.log(await saveScreenshot(await page.screenshot(), "1615-panel.png"));
const names = await page.evaluate(() => Array.from(document.querySelectorAll("input, [role=combobox], [contenteditable]")).map(b => (b.getAttribute("aria-label") || b.getAttribute("placeholder") || b.tagName)));
console.log(JSON.stringify(names));
