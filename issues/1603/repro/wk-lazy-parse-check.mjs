// Does the old JSC validate regex literals inside (lazily parsed) inner functions
// at parse time, or only when the function is first called?
import { webkit } from "playwright";
const browser = await webkit.launch();
const page = await browser.newPage();
await page.goto("about:blank");
console.log("UA:", await page.evaluate(() => navigator.userAgent));
console.log(
  await page.evaluate(() => {
    const out = {};
    try {
      const f = new Function("function inner(){ return /(?<=a)b/; } return inner;");
      out.parse = "ok";
      try {
        f()();
        out.call = "ok";
      } catch (e) {
        out.call = String(e);
      }
    } catch (e) {
      out.parse = String(e);
    }
    return out;
  }),
);
await browser.close();
