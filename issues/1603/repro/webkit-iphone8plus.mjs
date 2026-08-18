// Load the bb web app in Playwright WebKit emulating an iPhone 8 Plus
// (414x736 CSS px, DPR 3, iOS Safari UA, touch) and capture console errors,
// page errors and screenshots.
//
// Usage: node webkit-iphone8plus.mjs <appUrl> <outPrefix> [webkit|chromium]
import { webkit, chromium, devices } from "playwright";

const [appUrl, outPrefix, engine = "webkit"] = process.argv.slice(2);
if (!appUrl || !outPrefix) {
  console.error("usage: node webkit-iphone8plus.mjs <appUrl> <outPrefix> [webkit|chromium]");
  process.exit(2);
}
const device = devices["iPhone 8 Plus"];
const type = engine === "chromium" ? chromium : webkit;
const browser = await type.launch();
const ctx = await browser.newContext({ ...device, defaultBrowserType: undefined });
const page = await ctx.newPage();
const logs = [];
page.on("console", (m) => logs.push(`[console.${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
page.on("requestfailed", (r) => logs.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));

console.log("engine:", engine, "UA:", device.userAgent);
console.log("viewport:", JSON.stringify(device.viewport), "dpr:", device.deviceScaleFactor);
await page.goto(appUrl, { waitUntil: "load" });
await page.screenshot({ path: `${outPrefix}-load.png` });
// Give the SPA time to boot and settle (queries, websockets).
await page.waitForTimeout(6000);
const info = await page.evaluate(() => {
  const root = document.getElementById("root");
  const vis = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { w: r.width, h: r.height, display: cs.display, visibility: cs.visibility, opacity: cs.opacity, children: el.children.length };
  };
  const visibleText = document.body.innerText.trim().slice(0, 300);
  return {
    ua: navigator.userAgent,
    inner: [window.innerWidth, window.innerHeight],
    html: vis(document.documentElement),
    body: vis(document.body),
    root: vis(root),
    rootFirstChild: vis(root?.firstElementChild),
    buttons: document.querySelectorAll("button").length,
    links: document.querySelectorAll("a").length,
    visibleTextPreview: visibleText,
    supports: {
      dvh: CSS.supports("height", "100dvh"),
      colorMix: CSS.supports("color", "color-mix(in oklch, red 50%, blue)"),
      oklch: CSS.supports("color", "oklch(0.5 0 0)"),
      has: CSS.supports("selector(:has(a))"),
      container: CSS.supports("container-type", "inline-size"),
      nesting: CSS.supports("selector(&)"),
      property: typeof CSS.registerProperty === "function",
    },
  };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: `${outPrefix}-settled.png` });
console.log("--- page logs ---");
for (const l of logs) console.log(l);
await browser.close();
