const page = await browser.getPage("bb2019");
await page.reload();
await new Promise(r => setTimeout(r, 7000));
await page.screenshot({ path: "/tmp/bb-reports/issues/assets/2019-cli-tell-plain-plan.png" });
page.url()
