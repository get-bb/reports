const page = await browser.getPage("bb2130");
const out = "/tmp/bb-reports/issues/assets/2130-root-project-after.png";
await page.screenshot({ path: out });
({ url: page.url(), out });
