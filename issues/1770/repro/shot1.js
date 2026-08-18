const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:17232/projects/proj_pwhvqn62tm/threads/thr_j372x3cj2f", { waitUntil: "load" });
await new Promise((r) => setTimeout(r, 4000));
await page.getByText("Provisioned thread").first().click({ timeout: 5000 });
await new Promise((r) => setTimeout(r, 1500));
const p = await saveScreenshot(await page.screenshot(), "1770-thread-default.png");
console.log(p);
