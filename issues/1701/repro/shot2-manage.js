// dev-browser script: open Tasks -> Manage -> Folders on the dev instance and
// dump every button / combobox accessible name so we can prove no delete
// control exists on the folder rows.
const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:18366/plugins/tasks/tasks/manage");
await page.waitForTimeout(6000);
console.log(page.url());
const tab = await page.getByRole("tab", { name: "Folders" });
await tab.click().catch((e) => console.log("tab click failed", String(e)));
await page.waitForTimeout(1500);
await saveScreenshot(await page.screenshot(), "1701-manage-folders.png");
const buttons = await page.evaluate(() =>
  Array.from(document.querySelectorAll("button,[role=combobox]"))
    .map((b) => b.getAttribute("aria-label") || b.textContent.trim())
    .filter(Boolean),
);
console.log(JSON.stringify(buttons));
