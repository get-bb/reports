const page = await browser.getPage("bb1915");
await page.setViewportSize({ width: 1400, height: 1150 });
await page.goto("http://localhost:14376/extensions/plugins?view=installed", {
  waitUntil: "load",
});
await page.waitForTimeout(3000);
const row = page.getByText("Notify", { exact: true }).first();
await row.scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
const box = await row.boundingBox();
console.log(JSON.stringify(box));
await saveScreenshot(
  await page.screenshot({
    clip: { x: 360, y: box.y - 30, width: 990, height: 80 },
  }),
  "1915-installed-after-row-zoom.png",
);
