// dev-browser script (PR #1703 branch): open Manage -> Folders, click the new
// trash button on "Old stuff" (1 project + 1 subfolder), capture the confirm
// dialog, confirm, and capture the resulting list.
const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:18366/plugins/tasks/tasks/manage");
await page.waitForTimeout(6000);
await (await page.getByRole("tab", { name: "Folders" })).click();
await page.waitForTimeout(1500);
await saveScreenshot(await page.screenshot(), "1701-pr-folders.png");
const names = await page.evaluate(() =>
  Array.from(document.querySelectorAll("button"))
    .map((b) => b.getAttribute("aria-label") || b.textContent.trim())
    .filter((n) => /folder/i.test(n)),
);
console.log("folder buttons:", JSON.stringify(names));
await (await page.getByRole("button", { name: "Delete folder Old stuff" })).click();
await page.waitForTimeout(800);
await saveScreenshot(await page.screenshot(), "1701-pr-confirm.png");
console.log("dialog text:", await page.evaluate(() => document.querySelector('[role=dialog]')?.textContent));
await (await page.getByRole("button", { name: "Delete folder", exact: true })).click();
await page.waitForTimeout(1500);
await saveScreenshot(await page.screenshot(), "1701-pr-after.png");
console.log("alert:", await page.evaluate(() => document.querySelector('[role=alert]')?.textContent ?? null));
