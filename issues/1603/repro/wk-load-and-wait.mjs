// Load the bb web app in Playwright WebKit emulating an iPhone 8 Plus (414x736 CSS px,
// DPR 3, iOS Safari UA, touch), wait N ms, then dump: visible text, error-boundary
// state, console errors and page errors. Screenshots at load and after the wait.
//
// Usage: node wk-load-and-wait.mjs <appUrl> <outPrefix> [waitMs=15000] [engine=webkit]
// Run it through run-old-webkit160.sh (see setup-harness.sh) (old WebKit 16.0 build) or a normal Playwright.
import { webkit, chromium, devices } from "playwright";

const [appUrl, outPrefix, waitArg = "15000", engine = "webkit"] = process.argv.slice(2);
if (!appUrl || !outPrefix) {
  console.error("usage: node wk-load-and-wait.mjs <appUrl> <outPrefix> [waitMs] [webkit|chromium]");
  process.exit(2);
}
const device = devices["iPhone 8 Plus"];
const type = engine === "chromium" ? chromium : webkit;
const browser = await type.launch();
const ctx = await browser.newContext({ ...device, defaultBrowserType: undefined });
const page = await ctx.newPage();
const logs = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") logs.push(`[console.${m.type()}] ${m.text()}`);
});
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}\n${e.stack ?? ""}`));

console.log("engine:", engine, "UA:", device.userAgent);
console.log("viewport:", JSON.stringify(device.viewport), "dpr:", device.deviceScaleFactor);
const t0 = Date.now();
await page.goto(appUrl, { waitUntil: "load" });
await page.screenshot({ path: `${outPrefix}-load.png` });
const snapshot = async () =>
  page.evaluate(() => ({
    t: Date.now(),
    text: document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 240),
    errorBoundary: document.body.innerText.includes("bb hit an error and stopped"),
    buttons: document.querySelectorAll("button").length,
  }));
console.log("after load:", JSON.stringify(await snapshot()));
const waitMs = Number(waitArg);
const step = 1000;
let crashedAt = null;
for (let waited = 0; waited < waitMs; waited += step) {
  await page.waitForTimeout(step);
  const s = await snapshot();
  if (s.errorBoundary && crashedAt === null) {
    crashedAt = Date.now() - t0;
    console.log(`error boundary visible after ~${crashedAt} ms:`, JSON.stringify(s));
    // Expand the "Error details" disclosure so the screenshot shows the message.
    await page.evaluate(() => {
      for (const d of document.querySelectorAll("details")) d.open = true;
    });
    await page.waitForTimeout(300);
    break;
  }
}
console.log("final:", JSON.stringify(await snapshot()));
const details = await page.evaluate(() => {
  const pre = document.querySelector("details pre, details code");
  return pre ? pre.textContent : null;
});
if (details) console.log("error details:\n" + details.slice(0, 1200));
await page.screenshot({ path: `${outPrefix}-settled.png` });
console.log("--- console errors / page errors ---");
for (const l of logs) console.log(l.slice(0, 1500));
await browser.close();
