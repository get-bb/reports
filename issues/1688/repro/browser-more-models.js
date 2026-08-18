// dev-browser script: expand "More models" in the Cursor tab and snapshot.
const page = await browser.getPage("main");
const countOptions = async () =>
  page.getByRole("listbox", { name: "Models" }).getByRole("option").count();
if ((await countOptions()) <= 6) {
  await page.getByRole("button", { name: "More models" }).click();
  await page.waitForTimeout(1500);
}
const snap = await page.snapshotForAI({ depth: 40 });
const i = snap.full.indexOf('listbox "Models"');
console.log(snap.full.slice(i, i + 8000));
const p = await saveScreenshot(await page.screenshot(), "1688-cursor-more.png");
console.log(p);
