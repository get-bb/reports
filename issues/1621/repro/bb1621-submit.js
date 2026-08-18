const page = await browser.getPage("main");
const inputs = page.locator("input[type=password], input[type=text]");
console.log(await inputs.count());
await inputs.nth(0).fill("first-value — with dash");
await inputs.nth(1).fill("second-value");
await page.getByRole("button", { name: "Add secrets" }).click({ timeout: 5000 });
await new Promise((r) => setTimeout(r, 4000));
const buf = await page.screenshot({ fullPage: false });
await saveScreenshot(buf, "1621-after.png");
