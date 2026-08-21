const page = await browser.getPage("bb2130");
const out = "/tmp/bb-reports/issues/2130/logs/shot-tmp.png";
await page.screenshot({ path: out });
({ url: page.url(), out });
