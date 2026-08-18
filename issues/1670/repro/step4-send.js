// dev-browser script: type a tiny prompt next to the pasted HEIC and submit; then capture the thread timeline.
const page = await browser.getPage("bb1670");
const editor = page.locator('[contenteditable="true"]').first();
await editor.click({ timeout: 5000 });
await page.keyboard.type("Reply only with ok.");
await page.waitForTimeout(500);
await saveScreenshot(await page.screenshot(), "1670-submitting.png");
await page.keyboard.press("Enter");
await page.waitForTimeout(4000);
console.log("url after submit:", page.url());
// wait until an assistant reply shows up (max ~90s)
for (let i = 0; i < 45; i++) {
  const txt = await page.evaluate(() => document.body.innerText);
  if (/\bok\b/i.test(txt) && !/Reply only with ok\.\s*$/.test(txt) && txt.split(/\bok\b/i).length > 2) break;
  await page.waitForTimeout(2000);
}
await page.waitForTimeout(1500);
const imgs = await page.evaluate(() =>
  Array.from(document.querySelectorAll("img"))
    .filter((i) => /attachments\/content/.test(i.src))
    .map((i) => ({ src: i.src, alt: i.alt, complete: i.complete, naturalWidth: i.naturalWidth, naturalHeight: i.naturalHeight })),
);
console.log("timeline attachment imgs:", JSON.stringify(imgs, null, 2));
await saveScreenshot(await page.screenshot(), "1670-timeline-broken.png");
