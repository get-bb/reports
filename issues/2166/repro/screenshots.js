const p = await browser.getPage("bb2166");
await p.setViewport({ width: 1280, height: 800 });
await p.goto("http://localhost:17399/plugins/automations/automations");
await p.waitForLoad();
await new Promise((r) => setTimeout(r, 3000));
await p.screenshot({ path: "/tmp/bb-reports/issues/assets/2166-app-overview.png" });
const text1 = await p.evaluate(() => document.body.innerText.slice(0, 1500));
await p.goto(
  "http://localhost:17399/plugins/automations/automations/proj_avnv4kc427/auto_mcgeq09mobi",
);
await p.waitForLoad();
await new Promise((r) => setTimeout(r, 3000));
await p.screenshot({ path: "/tmp/bb-reports/issues/assets/2166-app-detail-victim.png" });
const text2 = await p.evaluate(() => document.body.innerText.slice(0, 1500));
({ text1, text2 });
