// Third run: hook window.fetch inside the page to record the exact JSON bodies
// the app posts: (a) normal Enter send on an idle thread, (b) Cmd+Enter steer
// while the turn is active after changing the picker.
const page = await browser.getPage("app");
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
    } catch (e) {
      window.__bodies.push({ error: String(e) });
    }
    return orig.apply(this, arguments);
  };
});
const pickerBtn = page.getByRole("button", { name: /Provider, model and reasoning/ });
console.log("picker before send:", JSON.stringify(await pickerBtn.innerText()));
const box = page.getByRole("textbox", { name: /Ask for a follow-up/ });
await box.click({ timeout: 5000 });
await box.type("Run sleep 60 in the terminal, then reply only with done.", { delay: 3 });
await page.keyboard.press("Enter");
await new Promise((r) => setTimeout(r, 12000));
// switch picker to Luna / Low (the turn started with Terra / Medium)
await pickerBtn.click({ timeout: 5000 });
await new Promise((r) => setTimeout(r, 700));
await page.getByRole("option", { name: "5.6-Luna" }).click({ timeout: 5000 });
await new Promise((r) => setTimeout(r, 500));
if ((await page.getByRole("dialog").count()) === 0) {
  await pickerBtn.click({ timeout: 5000 });
  await new Promise((r) => setTimeout(r, 500));
}
await page.getByRole("button", { name: "Low", exact: true }).click({ timeout: 5000 });
await new Promise((r) => setTimeout(r, 500));
if ((await page.getByRole("dialog").count()) > 0) {
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 300));
}
console.log("picker before steer:", JSON.stringify(await pickerBtn.innerText()));
await box.click({ timeout: 5000 });
await box.type("Steer: stop waiting and reply only with steered.", { delay: 3 });
const p0 = await saveScreenshot(await page.screenshot(), "1860-run3-before-steer.png");
await page.keyboard.press("Meta+Enter");
await new Promise((r) => setTimeout(r, 3000));
console.log("picker after steer:", JSON.stringify(await pickerBtn.innerText()));
const p1 = await saveScreenshot(await page.screenshot(), "1860-run3-after-steer.png");
console.log(p0, p1);
const bodies = await page.evaluate(() => window.__bodies);
console.log("CAPTURED", JSON.stringify(bodies, null, 2));
await writeFile("1860-captured-requests.json", JSON.stringify(bodies, null, 2));
