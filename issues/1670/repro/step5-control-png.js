// dev-browser script (control): paste the same picture as PNG into the follow-up composer of the thread; thumbnail renders.
const page = await browser.getPage("bb1670");
const editor = page.locator('[contenteditable="true"]').first();
await editor.click({ timeout: 5000 });
const result = await page.evaluate(async () => {
  const url =
    "http://localhost:20237/api/v1/projects/proj_2yvd4nxtww/attachments/content?path=sample-decoded-small-1787040542324-h2grwe.png";
  const bytes = await (await fetch(url)).arrayBuffer();
  const file = new File([bytes], "IMG_0001.png", { type: "image/png" });
  const dt = new DataTransfer();
  dt.items.add(file);
  const target = document.querySelector('[contenteditable="true"]');
  const ev = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true });
  target.dispatchEvent(ev);
  return { fileType: file.type, size: file.size, defaultPrevented: ev.defaultPrevented };
});
console.log("paste:", JSON.stringify(result));
await page.waitForTimeout(3000);
const imgs = await page.evaluate(() =>
  Array.from(document.querySelectorAll("img"))
    .filter((i) => /attachments\/content/.test(i.src))
    .map((i) => ({ src: i.src, alt: i.alt, complete: i.complete, naturalWidth: i.naturalWidth, naturalHeight: i.naturalHeight })),
);
console.log("attachment imgs:", JSON.stringify(imgs, null, 2));
await saveScreenshot(await page.screenshot(), "1670-control-png.png");
