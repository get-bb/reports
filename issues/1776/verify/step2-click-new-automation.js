// dev-browser script: click "New automation" with an EMPTY new-thread draft
const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });
// make sure there is no persisted new-thread draft
await page.goto("http://localhost:13907/", { waitUntil: "networkidle" });
await page.evaluate(() => {
  for (const k of Object.keys(localStorage)) if (k.includes("draft")) localStorage.removeItem(k);
});
await page.goto("http://localhost:13907/automations", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const btn = page.getByRole("button", { name: "New automation", exact: true });
await btn.hover();
await saveScreenshot(await page.screenshot(), "1776-verify-02-hover-new-automation.png");
await btn.click();
await page.waitForTimeout(2500);
console.log("url after click:", page.url());
await saveScreenshot(await page.screenshot(), "1776-verify-03-after-click-empty-draft.png");
const editor = page.locator('[contenteditable="true"], textarea').first();
console.log("composer text:", JSON.stringify(await editor.innerText().catch(() => null)));
console.log("localStorage draft keys:", JSON.stringify(await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.includes("draft")))));
