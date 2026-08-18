// What the un-guarded plugin call sites (plugins/connect/app.tsx,
// plugins/github/app.tsx) do on an insecure origin: they call
// navigator.clipboard.writeText(url).then(ok, fail) — this throws
// synchronously instead of reaching the rejection handler.
const page = await browser.getPage("lan");
console.log(
  await page.evaluate(() => {
    try {
      navigator.clipboard.writeText("x").then(() => {}, () => {});
      return "no throw";
    } catch (e) {
      return "sync throw: " + e.name + ": " + e.message;
    }
  }),
);
