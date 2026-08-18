// Walk the bb app through the main mobile flows in a WebKit build emulating an
// iPhone 8 Plus (414x736, DPR 3, iOS UA, touch) and screenshot each step.
// Records every pageerror / console.error. Usage:
//   node webkit-walkthrough.mjs <appUrl> <threadId> <outPrefix> [webkit|chromium]
import { webkit, chromium, devices } from "playwright";

const [appUrl, threadId, outPrefix, engine = "webkit"] = process.argv.slice(2);
const type = engine === "chromium" ? chromium : webkit;
const browser = await type.launch();
const ctx = await browser.newContext({ ...devices["iPhone 8 Plus"], defaultBrowserType: undefined });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(`[console.error] ${m.text()}`); });
page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));

const shot = async (name) => {
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${outPrefix}-${name}.png` });
  const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 200));
  console.log(`[${name}] visible text: ${text}`);
};

console.log("UA:", await (async () => { await page.goto("about:blank"); return page.evaluate(() => navigator.userAgent); })());
await page.goto(`${appUrl}/`, { waitUntil: "load" });
await page.waitForTimeout(6000);
await shot("01-home");

// Open the sidebar (mobile drawer)
await page.getByRole("button", { name: /toggle sidebar/i }).first().click();
await shot("02-sidebar-open");

// Settings -> Remote access section
await page.getByRole("button", { name: /^settings$/i }).first().click().catch(async () => {
  await page.getByText(/^Settings$/).first().click();
});
await shot("03-settings");
const remote = page.getByText(/Remote access/i).first();
if (await remote.count()) {
  await remote.click().catch(() => {});
  await shot("04-remote-access");
}
// Escape any dialog
await page.keyboard.press("Escape").catch(() => {});

// Thread view
await page.goto(`${appUrl}/threads/${threadId}`, { waitUntil: "load" });
await page.waitForTimeout(6000);
await shot("05-thread");

// New thread compose
await page.goto(`${appUrl}/`, { waitUntil: "load" });
await page.waitForTimeout(4000);
await page.getByText(/^New thread$/).first().click().catch(() => {});
await shot("06-new-thread");

console.log("--- errors ---");
for (const e of errors) console.log(e);
await browser.close();
