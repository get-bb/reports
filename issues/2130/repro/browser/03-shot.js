const page = await browser.getPage("bb2130");
const out = "/tmp/bb-reports/issues/2130/logs/shot.png";
await page.screenshot({ path: out });
({ url: page.url(), out });
