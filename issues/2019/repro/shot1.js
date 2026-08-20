const page = await browser.getPage("bb2019");
await page.setViewport({ width: 1300, height: 900 });
await page.goto("http://localhost:16733/");
await new Promise(r => setTimeout(r, 4000));
const link = await page.$('text/Reply only with ok.');
await link.click();
await new Promise(r => setTimeout(r, 6000));
await page.screenshot({ path: "/tmp/bb-reports/issues/assets/2019-fresh-session-plan-interaction.png" });
page.url()
