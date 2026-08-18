// dev-browser script: open the bb dev app and check whether Chromium can decode the uploaded HEIC.
const page = await browser.getPage("bb1670v");
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto("http://localhost:16802/", { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
console.log(page.url(), await page.title());
const r = await page.evaluate(async () => {
  const url =
    "http://localhost:24802/api/v1/projects/proj_hugfb39efv/attachments/content?path=sample-1787063017355-jbnsxq.heic";
  const resp = await fetch(url);
  const blob = await resp.blob();
  const img = new Image();
  const p = new Promise((res) => {
    img.onload = () => res("load");
    img.onerror = () => res("error");
  });
  img.src = URL.createObjectURL(blob);
  const ev = await p;
  return {
    status: resp.status,
    type: blob.type,
    size: blob.size,
    imgEvent: ev,
    naturalWidth: img.naturalWidth,
    ua: navigator.userAgent,
  };
});
console.log(JSON.stringify(r));
