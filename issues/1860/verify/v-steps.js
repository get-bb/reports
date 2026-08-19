const page = await browser.getPage("app");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:18197/projects/proj_e33ppqmig4/threads/thr_m8kiqnj4p8", { waitUntil: "networkidle", timeout: 25000 });
await new Promise((r) => setTimeout(r, 4000));
await page.evaluate(() => {
  window.__bodies = [];
  const orig = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = typeof input === "string" ? input : input.url;
      const method = (init && init.method) || "GET";
      if (method === "POST" && /\/api\/v1\/threads\//.test(url)) {
        window.__bodies.push({ url, body: init && typeof init.body === "string" ? JSON.parse(init.body) : String(init && init.body) });
      }
    } catch (e) { window.__bodies.push({ error: String(e) }); }
    return orig.apply(this, arguments);
  };
});
const pickerBtn = page.getByRole("button", { name: /Provider, model and reasoning/ });
console.log("picker initial:", JSON.stringify(await pickerBtn.innerText()));
console.log(await saveScreenshot(await page.screenshot(), "1860-v-before.png"));
await pickerBtn.click({ timeout: 5000 });
await new Promise((r) => setTimeout(r, 1000));
await page.getByRole("option", { name: "5.6-Luna" }).click({ timeout: 5000 });
await new Promise((r) => setTimeout(r, 800));
if ((await page.getByRole("dialog").count()) === 0) {
  await pickerBtn.click({ timeout: 5000 });
  await new Promise((r) => setTimeout(r, 800));
}
await page.getByRole("button", { name: "Low", exact: true }).click({ timeout: 5000 });
await new Promise((r) => setTimeout(r, 800));
if ((await page.getByRole("dialog").count()) > 0) { await page.keyboard.press("Escape"); await new Promise((r) => setTimeout(r, 500)); }
console.log("picker after change:", JSON.stringify(await pickerBtn.innerText()));
const box = page.getByRole("textbox", { name: /Ask for a follow-up/ });
await box.click({ timeout: 5000 });
await box.type("Steer: stop waiting and reply only with steered.", { delay: 3 });
console.log("Stop run visible:", (await page.getByRole("button", { name: /Stop run/ }).count()) > 0);
console.log(await saveScreenshot(await page.screenshot(), "1860-v-before-steer.png"));
await page.keyboard.press("Meta+Enter");
await new Promise((r) => setTimeout(r, 3000));
console.log("picker after steer:", JSON.stringify(await pickerBtn.innerText()));
console.log(await saveScreenshot(await page.screenshot(), "1860-v-after-steer.png"));
console.log("CAPTURED", JSON.stringify(await page.evaluate(() => window.__bodies), null, 2));
