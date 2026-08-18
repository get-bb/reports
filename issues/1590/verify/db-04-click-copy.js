// Click the "Copy message" action on the assistant reply and capture the toast.
const page = await browser.getPage("lan");
const msg = page.getByText("ok", { exact: true }).last();
await msg.hover({ timeout: 5000 });
await page.waitForTimeout(400);
const btn = page.getByRole("button", { name: "Copy message" }).last();
await btn.hover({ timeout: 5000 });
await page.waitForTimeout(300);
console.log(
  await saveScreenshot(await page.screenshot(), "1590-verify-lan-hover-copy.png"),
);
await btn.click({ timeout: 5000 });
await page.waitForTimeout(600);
console.log(
  await saveScreenshot(await page.screenshot(), "1590-verify-lan-after-copy.png"),
);
const toasts = await page.evaluate(() =>
  Array.from(document.querySelectorAll("[data-sonner-toast], [role=status], [role=alert]"))
    .map((e) => e.textContent.trim())
    .filter(Boolean),
);
console.log(JSON.stringify(toasts));
