const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:14920/projects/proj_9zmfm7fd7f/threads/thr_pqm2zu3irf", { waitUntil: "load" });
await page.waitForTimeout(8000);
const links = await page.$$eval("a", (as) =>
  as.map((a) => ({ text: a.textContent, href: a.getAttribute("href") })).filter((l) => /example|notes/.test(l.href || "")),
);
console.log(JSON.stringify(links, null, 1));
await saveScreenshot(await page.screenshot(), "1182-verify-thread.png");
const link = page.getByRole("link", { name: /this link/ }).last();
console.log("href attr:", await link.getAttribute("href"));
await link.click();
await page.waitForTimeout(3000);
await saveScreenshot(await page.screenshot(), "1182-verify-after-click.png");
const btn = page.getByRole("button", { name: /open in editor/i }).first();
console.log("button label:", await btn.getAttribute("aria-label"));
await btn.click();
await page.waitForTimeout(3500);
await saveScreenshot(await page.screenshot(), "1182-verify-open-in-editor.png");
const t = await page.evaluate(() => document.body.innerText);
const i = t.indexOf("Failed to open");
console.log("toast text:", JSON.stringify(i >= 0 ? t.slice(i, i + 300) : t.slice(-400)));
