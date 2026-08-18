// dev-browser script: click "New automation" when the new-thread composer already holds a draft
const page = await browser.getPage("main2");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:17447/", { waitUntil: "networkidle" });
await page.evaluate(() => {
  for (const k of Object.keys(localStorage)) if (k.includes("draft")) localStorage.removeItem(k);
});
await page.goto("http://localhost:17447/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
// user types something in the New thread box, then wanders off to Automations
const editor = page.locator('[contenteditable="true"]').first();
await editor.click();
await page.keyboard.type("fix the flaky test");
await page.waitForTimeout(1500);
await saveScreenshot(await page.screenshot(), "1776-04-existing-draft.png");
await page.goto("http://localhost:17447/automations", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.getByRole("button", { name: "New automation", exact: true }).click();
await page.waitForTimeout(2500);
console.log("url after click:", page.url());
await saveScreenshot(await page.screenshot(), "1776-05-after-click-existing-draft.png");
console.log("composer text:", JSON.stringify(await page.locator('[contenteditable="true"]').first().innerText()));
