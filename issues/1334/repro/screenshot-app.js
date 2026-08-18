const page = await browser.getPage("main");
await page.setViewportSize({ width: 1280, height: 800 });
const t0 = Date.now();
try {
  await page.goto("http://127.0.0.1:48861/", { timeout: 15000, waitUntil: "domcontentloaded" });
} catch (e) {
  console.log("goto error: " + e.message);
}
console.log("goto took " + (Date.now() - t0) + "ms");
await new Promise((r) => setTimeout(r, 4000));
console.log(await saveScreenshot(await page.screenshot(), "1334-app-under-pressure-a.png"));
await new Promise((r) => setTimeout(r, 8000));
console.log(await saveScreenshot(await page.screenshot(), "1334-app-under-pressure-b.png"));
console.log(await page.title(), page.url());
