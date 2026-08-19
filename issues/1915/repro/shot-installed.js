// usage: SUFFIX via file name; edit `suffix` below
const suffix = "__SUFFIX__";
const page = await browser.getPage("bb1915");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:14376/extensions/plugins", {
  waitUntil: "load",
});
await page.waitForTimeout(2500);
await page.getByText("Installed plugins", { exact: true }).first().click();
await page.waitForTimeout(2500);
const notify = page.getByText("Notify", { exact: true }).first();
if (await notify.count()) await notify.scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
console.log(page.url());
await saveScreenshot(await page.screenshot(), `1915-installed-${suffix}.png`);
if (await notify.count()) {
  await notify.click();
  await page.waitForTimeout(2500);
  console.log(page.url());
  await saveScreenshot(
    await page.screenshot(),
    `1915-notify-detail-${suffix}.png`,
  );
}
