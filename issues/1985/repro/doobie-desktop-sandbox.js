// Frame the real API content URL (no data: URL) inside the Electron renderer to
// confirm the viewer also loads for host/project/thread-storage previews.
const pages = await browser.listPages();
const target = pages.find((p) => p.url.startsWith("http://localhost:14918"));
const page = await browser.getPage(target.id);
await page.evaluate(() => {
  document.getElementById("qa-pdf-frame")?.remove();
  const f = document.createElement("iframe");
  f.id = "qa-pdf-frame";
  f.setAttribute("sandbox", "allow-scripts allow-same-origin"); f.src = "/api/v1/projects/proj_cw26yy9qhd/files/content?path=handbook.pdf";
  f.style.cssText = "position:fixed;left:20px;top:300px;width:600px;height:500px;z-index:99999;border:3px solid red;background:#fff";
  document.body.appendChild(f);
});
await new Promise((r) => setTimeout(r, 5000));
await page.screenshot({ path: "/tmp/bb-reports/issues/assets/1985-desktop-sandbox-test.png" });
await page.evaluate(() => document.getElementById("qa-pdf-frame")?.remove());
"done";
