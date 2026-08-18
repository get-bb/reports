// In an old WebKit, wrap the RegExp constructor to log every pattern that the
// engine rejects, then dynamically import the given chunk(s). This catches
// `new RegExp(string)` calls executed at module top level (regex literals are
// parse-time and cannot be intercepted; see webkit-find-bad-regex.mjs for those).
// Usage: node webkit-trap-regexp.mjs <appUrl> <chunkName> [<chunkName> ...]
import { webkit } from "playwright";
const [appUrl, ...chunks] = process.argv.slice(2);
const browser = await webkit.launch();
const page = await browser.newPage();
await page.addInitScript(() => {
  const Orig = RegExp;
  const rejected = [];
  window.__rejectedRegExps = rejected;
  const Wrapped = function RegExp(pattern, flags) {
    try {
      return new.target ? new Orig(pattern, flags) : Orig(pattern, flags);
    } catch (e) {
      rejected.push({ pattern: String(pattern).slice(0, 300), flags: String(flags ?? ""), error: String(e) });
      throw e;
    }
  };
  Wrapped.prototype = Orig.prototype;
  Object.setPrototypeOf(Wrapped, Orig);
  window.RegExp = Wrapped;
});
await page.goto(`${appUrl}/`, { waitUntil: "load" });
console.log("UA:", await page.evaluate(() => navigator.userAgent));
for (const c of chunks) {
  const r = await page.evaluate(async (n) => {
    window.__rejectedRegExps.length = 0;
    try {
      await import(`/assets/${n}`);
      return { ok: true, rejected: [...window.__rejectedRegExps] };
    } catch (e) {
      return { ok: false, error: `${e?.name}: ${e?.message}`, rejected: [...window.__rejectedRegExps] };
    }
  }, c);
  console.log(`== ${c}: ${r.ok ? "loaded" : r.error}`);
  for (const x of r.rejected) console.log(`  rejected: /${x.pattern}/${x.flags} -> ${x.error}`);
}
await browser.close();
