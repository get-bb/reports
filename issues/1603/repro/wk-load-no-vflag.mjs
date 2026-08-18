// Simulate a real Safari 16.4-16.6 engine (iOS 16.4-16.7, e.g. an up-to-date iPhone
// 8 Plus): Playwright's webkit-1837 is a WebKit *trunk* build that already has the
// RegExp `v` (unicodeSets) flag, which shipping Safari only got in 17.0. This init
// script makes the RegExp constructor reject flag `v` exactly like Safari 16.x does
// ("Invalid flags supplied to RegExp constructor.") and then loads the app in the
// iPhone 8 Plus emulation. Regex *literals* are untouched (they are still parsed by
// the engine), so only constructor calls are affected — which is precisely what the
// bundler-folded oniguruma-to-es feature detection uses at module top level.
// Usage: node wk-load-no-vflag.mjs <appUrl> <outPrefix> [waitMs=10000]
import { webkit, devices } from "playwright";
const [appUrl, outPrefix, waitArg = "10000"] = process.argv.slice(2);
const device = devices["iPhone 8 Plus"];
const browser = await webkit.launch();
const ctx = await browser.newContext({ ...device, defaultBrowserType: undefined });
await ctx.addInitScript(() => {
  const Orig = RegExp;
  const Wrapped = function RegExp(pattern, flags) {
    if (typeof flags === "string" && flags.includes("v")) {
      throw new SyntaxError("Invalid flags supplied to RegExp constructor.");
    }
    return new.target ? new Orig(pattern, flags) : Orig(pattern, flags);
  };
  Wrapped.prototype = Orig.prototype;
  Object.setPrototypeOf(Wrapped, Orig);
  Object.defineProperty(Wrapped, Symbol.species, { get: () => Wrapped });
  window.RegExp = Wrapped;
});
const page = await ctx.newPage();
const logs = [];
page.on("console", (m) => {
  if (m.type() === "error") logs.push(`[console.error] ${m.text()}`);
});
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
console.log("UA:", device.userAgent);
console.log(
  "engine v-flag support (native):",
  await (await browser.newPage()).evaluate(() => {
    try { new RegExp("[[]]", "v"); return "yes"; } catch { return "no"; }
  }),
);
await page.goto(appUrl, { waitUntil: "load" });
await page.screenshot({ path: `${outPrefix}-load.png` });
const snap = () =>
  page.evaluate(() => ({
    text: document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 200),
    errorBoundary: document.body.innerText.includes("bb hit an error and stopped"),
  }));
console.log("after load:", JSON.stringify(await snap()));
for (let waited = 0; waited < Number(waitArg); waited += 1000) {
  await page.waitForTimeout(1000);
  const s = await snap();
  if (s.errorBoundary) {
    console.log(`error boundary after ~${waited + 1000} ms`);
    await page.evaluate(() => { for (const d of document.querySelectorAll("details")) d.open = true; });
    await page.waitForTimeout(300);
    break;
  }
}
console.log("final:", JSON.stringify(await snap()));
const details = await page.evaluate(() => document.querySelector("details pre, details code")?.textContent ?? null);
if (details) console.log("error details:\n" + details.slice(0, 600));
await page.screenshot({ path: `${outPrefix}-settled.png` });
console.log("--- errors ---");
for (const l of logs.filter((l) => !/Access-Control|WebSocket|access control|Failed to load resource/.test(l))) console.log(l.slice(0, 800));
await browser.close();
