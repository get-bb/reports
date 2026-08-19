const page = await browser.getPage("app");
const pickerBtn = page.getByRole("button", { name: /Provider, model and reasoning/ });
console.log("picker after steer:", JSON.stringify(await pickerBtn.innerText()));
console.log(await saveScreenshot(await page.screenshot(), "1860-v-after-steer.png"));
const bodies = await page.evaluate(() => window.__bodies);
console.log("CAPTURED", JSON.stringify(bodies, null, 2));
await writeFile("1860-v-bodies.json", JSON.stringify(bodies, null, 2));
