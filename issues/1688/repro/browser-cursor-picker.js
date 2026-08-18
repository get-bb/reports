// dev-browser script: open the Cursor tab of the model picker and snapshot it.
const page = await browser.getPage("main");
await page.getByRole("button", { name: "Cursor", exact: true }).click();
await page.waitForTimeout(6000);
const snap = await page.snapshotForAI({ depth: 40 });
const i = snap.full.indexOf('listbox "Models"');
console.log(snap.full.slice(i, i + 5000));
const p = await saveScreenshot(await page.screenshot(), "1688-cursor-picker.png");
console.log(p);
