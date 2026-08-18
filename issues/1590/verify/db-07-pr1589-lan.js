// With PR #1589 applied on top of 16ceb3a54: copy from the LAN origin, then
// read the browser clipboard from the localhost page (which has the API).
const local = await browser.getPage("local");
await local.goto("http://localhost:13934/projects/proj_67cuq4v8fc/threads/thr_3q88fks8ry", { waitUntil: "load", timeout: 30000 });
await local.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost:13934" });
await local.evaluate(() => navigator.clipboard.writeText("SENTINEL-before"));
console.log("clipboard before: " + (await local.evaluate(() => navigator.clipboard.readText())));

const page = await browser.getPage("lan");
await page.goto("http://192.168.4.29:26934/projects/proj_67cuq4v8fc/threads/thr_3q88fks8ry", { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(4000);
console.log(
  JSON.stringify(
    await page.evaluate(() => ({
      origin: location.origin,
      isSecureContext: window.isSecureContext,
      navigatorClipboard: typeof navigator.clipboard,
      activeBefore: document.activeElement && document.activeElement.tagName,
    })),
  ),
);
const msg = page.getByText("ok", { exact: true }).last();
await msg.hover({ timeout: 5000 });
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Copy message" }).last().click({ timeout: 5000 });
await page.waitForTimeout(600);
console.log(
  await saveScreenshot(await page.screenshot(), "1590-verify-pr1589-lan-after-copy.png"),
);
const toasts = await page.evaluate(() =>
  Array.from(document.querySelectorAll("[data-sonner-toast]"))
    .map((e) => e.textContent.trim())
    .filter(Boolean),
);
console.log("toasts: " + JSON.stringify(toasts));
console.log(
  JSON.stringify(
    await page.evaluate(() => ({
      leftoverTextarea: document.querySelectorAll("textarea[aria-hidden=true]").length,
      activeAfter: document.activeElement && document.activeElement.tagName,
    })),
  ),
);
console.log("clipboard after: " + (await local.evaluate(() => navigator.clipboard.readText())));
