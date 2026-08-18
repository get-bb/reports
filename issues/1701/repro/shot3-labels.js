// dev-browser script: show the Labels tab for comparison -- label rows DO
// have a trash button, folder rows do not.
const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:18366/plugins/tasks/tasks/manage");
await page.waitForTimeout(6000);
await (await page.getByRole("tab", { name: "Labels" })).click();
await page.waitForTimeout(1500);
await saveScreenshot(await page.screenshot(), "1701-manage-labels.png");
const buttons = await page.evaluate(() =>
  Array.from(document.querySelectorAll("button"))
    .map((b) => b.getAttribute("aria-label") || b.textContent.trim())
    .filter((n) => /delete|remove|trash/i.test(n)),
);
console.log("delete-ish buttons on Labels tab:", JSON.stringify(buttons));
