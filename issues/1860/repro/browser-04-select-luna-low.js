const page = await browser.getPage("app");
// Picker is open from the previous step. Select Luna, then Low.
await page.getByRole("option", { name: "5.6-Luna" }).click({ timeout: 5000 });
await new Promise((r) => setTimeout(r, 800));
// The picker may close after selecting a model; reopen if needed.
const dialog = page.getByRole("dialog");
if ((await dialog.count()) === 0) {
  await page.getByRole("button", { name: /Provider, model and reasoning/ }).click({ timeout: 5000 });
  await new Promise((r) => setTimeout(r, 800));
}
await page.getByRole("button", { name: "Low", exact: true }).click({ timeout: 5000 });
await new Promise((r) => setTimeout(r, 800));
if ((await page.getByRole("dialog").count()) > 0) {
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 500));
}
const label = await page.getByRole("button", { name: /Provider, model and reasoning/ }).innerText();
console.log("picker label:", JSON.stringify(label));
const aria = await page.evaluate(() => {
  const el = document.querySelector('[aria-label^="Codex:"]');
  return el ? el.getAttribute("aria-label") : null;
});
console.log("aria:", aria);
const p = await saveScreenshot(await page.screenshot(), "1860-picker-luna-low.png");
console.log(p);
