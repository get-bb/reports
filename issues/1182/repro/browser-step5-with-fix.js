const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:17374/projects/proj_xfhduummc3/threads/thr_em7hmw2zzh", { waitUntil: "load" });
await page.waitForTimeout(7000);
const links = await page.$$eval("a", (as) =>
  as.map((a) => ({ text: a.textContent, href: a.getAttribute("href") })).filter((l) => /example|notes/.test(l.href || "")),
);
console.log(JSON.stringify(links, null, 1));
await saveScreenshot(await page.screenshot(), "1182-with-fix.png");
