const page = await browser.getPage("main");
await page.getByRole("link", {name: /Alpha thread/}).first().click().catch(async () => {
  await page.getByText("Alpha thread").first().click();
});
await page.waitForTimeout(2500);
console.log("thread url:", page.url());
await saveScreenshot(await page.screenshot(), "1618-verify-02-alpha-thread-open.png");
// Web keybinding for thread.new is Mod+Shift+O (Mod+N is desktop-only).
await page.keyboard.press("Control+Shift+O");
await page.waitForTimeout(2000);
console.log("after shortcut url:", page.url());
const trigger = page.locator("[data-promptbox-project-control]").first();
console.log("composer project:", (await trigger.innerText()).replace(/\n/g, " | "));
console.log("stored:", await page.evaluate(() => localStorage.getItem("bb.root-compose.project-id")));
await saveScreenshot(await page.screenshot(), "1618-verify-03-after-new-thread-shortcut.png");
