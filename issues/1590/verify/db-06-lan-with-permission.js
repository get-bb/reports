// Even with clipboard permissions granted for the LAN origin, the API is absent
// (secure-context gating, not a permission problem).
const page = await browser.getPage("lan");
try {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://192.168.4.29:26934",
  });
  console.log("granted clipboard permissions for LAN origin");
} catch (e) {
  console.log("grantPermissions failed: " + e.message);
}
await page.reload({ waitUntil: "load", timeout: 30000 });
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
await page.getByRole("button", { name: "Copy message" }).last().click({ timeout: 5000 });
await page.waitForTimeout(600);
const toasts = await page.evaluate(() =>
  Array.from(document.querySelectorAll("[data-sonner-toast]"))
    .map((e) => e.textContent.trim())
    .filter(Boolean),
);
console.log(JSON.stringify(toasts));
