const page = await browser.getPage("v2130");
const name = "root-project-stale";
await page.screenshot({ path: `/tmp/bb-reports/issues/2130/verify/${name}.png` });
const s = await page.snapshot({ interactive: true, track: "main" });
s.full.slice(0, 6000);
