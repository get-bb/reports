// Playwright: screenshot the thread page (pending secret-request form, or its absence).
// Usage: APP_URL=... THREAD_URL_PATH=/projects/<proj>/threads/<thr> OUT=/path.png node bb1621-thread-screenshot.mjs
import { chromium } from "/home/sawyer/.dev-browser/node_modules/playwright-core/index.mjs";
const APP_URL = process.env.APP_URL ?? "http://localhost:14666";
const PATH = process.env.THREAD_URL_PATH ?? "/projects/proj_n34ptw2nup/threads/thr_m5apn4t6y5";
const OUT = process.env.OUT ?? "/tmp/bb1621-thread.png";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`${APP_URL}${PATH}`, { waitUntil: "networkidle" });
await page.waitForTimeout(4000);
console.log(page.url());
await page.screenshot({ path: OUT });
await browser.close();
