const page = await browser.getPage("bb2062");
const s = await page.snapshot({ interactive: true });
const str = String(typeof s === "string" ? s : JSON.stringify(s));
const i = str.indexOf("dialog");
await page.screenshot({ path: "/tmp/bb-reports/issues/2062/repro/debug-current.png" });
({ dialog: i >= 0 ? str.slice(i, i + 3000) : "no dialog", tail: str.slice(-1500) })
