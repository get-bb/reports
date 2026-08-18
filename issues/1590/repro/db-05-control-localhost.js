// Control: same thread via http://localhost (a "potentially trustworthy" origin).
const page = await browser.getPage("local");
try {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://localhost:16106",
  });
  console.log("granted clipboard permissions for localhost origin");
} catch (e) {
  console.log("grantPermissions failed: " + e.message);
}
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(
  "http://localhost:16106/projects/proj_nu5jy7nj4y/threads/thr_eumrti6rv5",
  { waitUntil: "load", timeout: 30000 },
);
await page.waitForTimeout(4000);
console.log(
  JSON.stringify(
    await page.evaluate(() => ({
      origin: location.origin,
      isSecureContext: window.isSecureContext,
      navigatorClipboard: typeof navigator.clipboard,
    })),
  ),
);
const msg = page.getByText("ok", { exact: true }).last();
await msg.hover({ timeout: 5000 });
await page.waitForTimeout(400);
const btn = page.getByRole("button", { name: "Copy message" }).last();
await btn.click({ timeout: 5000 });
await page.waitForTimeout(600);
console.log(
  await saveScreenshot(await page.screenshot(), "1590-localhost-after-copy.png"),
);
const toasts = await page.evaluate(() =>
  Array.from(document.querySelectorAll("[data-sonner-toast]"))
    .map((e) => e.textContent.trim())
    .filter(Boolean),
);
console.log(JSON.stringify(toasts));
try {
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  console.log("clipboard now contains: " + JSON.stringify(clip));
} catch (e) {
  console.log("readText failed: " + e.message);
}
