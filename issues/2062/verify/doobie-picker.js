const page = await browser.getPage("v2062");
await page.screenshot({ path: "/tmp/bb-reports/issues/2062/verify/v-01-before.png" });
await page.click("ref/e104");
await new Promise((r) => setTimeout(r, 2500));
const s = await page.snapshot({ interactive: true });
const text = typeof s === "string" ? s : (s.full ?? s.text ?? JSON.stringify(s));
const i = String(text).indexOf("dialog");
({ snap: String(text).slice(Math.max(0, i - 200), i + 4500) })
