// PR #1589, "Clipboard API present but rejects" branch, in a real browser:
// localhost is a secure context but the Playwright context has no
// clipboard-write permission, so navigator.clipboard.writeText rejects.
const local = await browser.getPage("local");
await local.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost:16106" });
await local.goto("http://localhost:16106/", { waitUntil: "load", timeout: 30000 });
await local.evaluate(() => navigator.clipboard.writeText("SENTINEL-08"));
console.log("clipboard before: " + (await local.evaluate(() => navigator.clipboard.readText())));
await local.context().clearPermissions();
await local.goto(
  "http://localhost:16106/projects/proj_nu5jy7nj4y/threads/thr_eumrti6rv5",
  { waitUntil: "load", timeout: 30000 },
);
await local.waitForTimeout(4000);
console.log(
  await local.evaluate(() =>
    navigator.clipboard.writeText("probe").then(
      () => "writeText resolved (permission present)",
      (e) => "writeText rejected: " + e.name + ": " + e.message,
    ),
  ),
);
const msg = local.getByText("ok", { exact: true }).last();
await msg.hover({ timeout: 5000 });
await local.waitForTimeout(400);
await local.getByRole("button", { name: "Copy message" }).last().click({ timeout: 5000 });
await local.waitForTimeout(600);
const toasts = await local.evaluate(() =>
  Array.from(document.querySelectorAll("[data-sonner-toast]"))
    .map((e) => e.textContent.trim())
    .filter(Boolean),
);
console.log("toasts: " + JSON.stringify(toasts));
await local.context().grantPermissions(["clipboard-read", "clipboard-write"], {
  origin: "http://localhost:16106",
});
console.log("clipboard after: " + (await local.evaluate(() => navigator.clipboard.readText())));
