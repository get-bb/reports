const page = await browser.getPage("bb1778");
const errs = await page.$$(".katex-error");
const assistantErr = errs[errs.length - 1];
const box = await assistantErr.boundingBox();
const container = await page.evaluateHandle((el) => el.closest("[data-markdown-preview]"), assistantErr);
const cbox = await container.boundingBox();
await page.screenshot({
  path: "/tmp/bb-reports/issues/assets/1778-assistant-message-zoom.png",
  clip: { x: Math.max(0, cbox.x - 20), y: Math.max(0, cbox.y - 20), width: Math.min(1280, cbox.width + 40), height: cbox.height + 40 },
});
const html = await page.evaluate((el) => el.closest("[data-markdown-preview]").innerHTML, assistantErr);
({ box, html });
