// Playwright script: open the tasks panel of the dev app, click the "1621 repro" task,
// log every /attachments/download response status, and screenshot the detail view
// (the em-dash-named image attachment renders as a broken image because the GET 500s).
// Usage: APP_URL=http://localhost:<app-port> node bb1621-tasks-screenshot.mjs
// Adjust the playwright-core import path to any local install.
import { chromium } from "/home/sawyer/.dev-browser/node_modules/playwright-core/index.mjs";
const APP_URL = process.env.APP_URL ?? "http://localhost:14666";
const OUT = process.env.OUT ?? "/tmp/bb-reports/issues/assets/1621-tasks-broken-attachment.png";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const downloads = [];
page.on("response", (r) => {
  if (r.url().includes("/attachments/download")) downloads.push(`${r.status()} ${r.url()}`);
});
await page.goto(`${APP_URL}/plugins/tasks/tasks`, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
await page.getByRole("button", { name: "Open Q1621-1: 1621 repro" }).click();
await page.waitForTimeout(4000);
console.log(page.url());
console.log(downloads.join("\n") || "(no attachment download requests seen)");
await page.screenshot({ path: OUT });
await browser.close();
