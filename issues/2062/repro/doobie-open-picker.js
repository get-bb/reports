const page = await browser.getPage("bb2062");
await page.screenshot({ path: "/tmp/bb-reports/issues/assets/2062-01-before-composer.png" });
await page.click("ref/e104");
await new Promise((r) => setTimeout(r, 1200));
const s = await page.snapshot({ interactive: true });
({ snap: String(typeof s === "string" ? s : JSON.stringify(s)).slice(0, 9000) })
