// In an old WebKit, dynamically import every production chunk listed in
// dist/assets and report which ones fail to evaluate (and why). This pinpoints
// the module whose regex/syntax the engine rejects.
// Usage: node webkit-find-bad-chunk.mjs <appUrl> <distAssetsDir>
import { webkit } from "playwright";
import { readdirSync } from "node:fs";

const [appUrl, assetsDir] = process.argv.slice(2);
const chunks = readdirSync(assetsDir).filter((f) => f.endsWith(".js"));
const browser = await webkit.launch();
const page = await browser.newPage();
await page.goto(`${appUrl}/`, { waitUntil: "load" });
await page.waitForTimeout(3000);
console.log("UA:", await page.evaluate(() => navigator.userAgent));
const results = await page.evaluate(async (names) => {
  const out = [];
  for (const n of names) {
    try {
      await import(`/assets/${n}`);
    } catch (e) {
      out.push(`${n}: ${e?.name}: ${e?.message}`);
    }
  }
  return out;
}, chunks);
console.log(`checked ${chunks.length} chunks; ${results.length} failed`);
for (const r of results) console.log(r);
await browser.close();
