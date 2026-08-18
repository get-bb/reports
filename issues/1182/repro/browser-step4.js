const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:17374/projects/proj_xfhduummc3/threads/thr_em7hmw2zzh", { waitUntil: "load" });
await page.waitForTimeout(7000);
const links = await page.$$eval("a", (as) =>
  as.map((a) => ({ text: a.textContent, href: a.getAttribute("href") })).filter((l) => /example|notes/.test(l.href || "")),
);
console.log(JSON.stringify(links, null, 1));
await saveScreenshot(await page.screenshot(), "1182-inline-code-links.png");
const link = page.getByRole("link", { name: "~/notes.md" }).last();
await link.click();
await page.waitForTimeout(3000);
const btn = page.getByRole("button", { name: /open in editor/i }).first();
await btn.click();
await page.waitForTimeout(3500);
await saveScreenshot(await page.screenshot(), "1182-inline-code-open-in-editor.png");
const t = await page.evaluate(() => document.body.innerText);
const i = t.indexOf("Failed to open");
console.log("toast text:", JSON.stringify(i >= 0 ? t.slice(i, i + 300) : t.slice(-400)));
