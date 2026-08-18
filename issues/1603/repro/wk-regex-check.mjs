// Compile specific regex patterns in a Playwright WebKit build, both via the
// RegExp constructor and as a source literal (eval), to see what the engine rejects.
// Usage: node wk-regex-check.mjs
import { webkit } from "playwright";
const cases = [
  // oniguruma-to-es (Shiki JS regex engine) — worker-portable / workspace-checkout-display chunks
  { pattern: String.raw`(?<capture>\((?:\?<(?![=!])(?<name>[^>]+)>|(?!\?)))|\\?.`, flags: "gsu" },
  // @pierre/diffs SPLIT_WITH_NEWLINES
  { pattern: String.raw`(?<=\n)`, flags: "" },
  // mdast-util-gfm-autolink-literal email
  { pattern: String.raw`(?<=^|\s|\p{P}|\p{S})([-.\w+]+)@([-\w]+(?:\.[-\w]+)+)`, flags: "gu" },
  // named group only, no lookbehind
  { pattern: String.raw`(?<name>[^>]+)>`, flags: "gsu" },
  { pattern: String.raw`(?<name>[^>]+)>`, flags: "g" },
  // oniguruma-to-es envFlags detection (constant-folded to `true` by the bundler)
  { pattern: String.raw`[[]]`, flags: "v" },
  { pattern: String.raw`[[^a]]`, flags: "v" },
  { pattern: String.raw`(?i:)`, flags: "" },
];
const browser = await webkit.launch();
const page = await browser.newPage();
await page.goto("about:blank");
console.log("UA:", await page.evaluate(() => navigator.userAgent));
const out = await page.evaluate((cases) =>
  cases.map((c) => {
    let ctor = "ok", lit = "ok";
    try { new RegExp(c.pattern, c.flags); } catch (e) { ctor = String(e); }
    try { (0, eval)("/" + c.pattern + "/" + c.flags); } catch (e) { lit = String(e); }
    return { ...c, ctor, lit };
  }), cases);
for (const o of out) console.log(`/${o.pattern}/${o.flags}\n   new RegExp: ${o.ctor}\n   literal   : ${o.lit}`);
await browser.close();
