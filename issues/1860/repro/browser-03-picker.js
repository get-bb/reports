const page = await browser.getPage("app");
await page.getByRole("button", { name: /Provider, model and reasoning/ }).click({ timeout: 5000 });
await new Promise((r) => setTimeout(r, 1200));
const snap = await page.snapshotForAI({ track: "picker", timeout: 5000 });
const txt = snap.full;
const i = txt.search(/dialog|menu|listbox/);
console.log(txt.slice(i, i + 5000));
const p = await saveScreenshot(await page.screenshot(), "1860-picker-open.png");
console.log(p);
