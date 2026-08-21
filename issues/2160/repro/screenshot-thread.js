const page = await browser.getPage("bb2160");
await page.setViewport({ width: 1400, height: 1000 });
await page.goto("http://localhost:17835/");
await page.waitForLoad();
await new Promise((r) => setTimeout(r, 4000));
const links = await page.$$eval("a", (as) => as.map((a) => ({ t: a.textContent?.trim(), h: a.getAttribute("href") })).filter((x) => x.t && x.t.includes("2160 repro")));
if (links.length > 0) {
  await page.goto("http://localhost:17835" + links[0].h);
  await page.waitForLoad();
  await new Promise((r) => setTimeout(r, 6000));
}
await page.screenshot({ path: "/tmp/bb-reports/issues/assets/2160-thread-view.png", fullPage: false });
({ url: page.url(), links });
