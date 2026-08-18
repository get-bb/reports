// For each given production chunk: parse it with acorn, collect every regex
// literal, then compile each one inside the old WebKit and report the ones the
// engine rejects. Usage:
//   node webkit-find-bad-regex.mjs <appUrl> <chunkFile> [<chunkFile> ...]
import { webkit } from "playwright";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const acorn = require("acorn");
const walk = require("acorn-walk");

const [appUrl, ...files] = process.argv.slice(2);
const browser = await webkit.launch();
const page = await browser.newPage();
await page.goto(`${appUrl}/`, { waitUntil: "load" });
console.log("UA:", await page.evaluate(() => navigator.userAgent));
for (const f of files) {
  const src = readFileSync(f, "utf8");
  const ast = acorn.parse(src, { ecmaVersion: "latest", sourceType: "module" });
  const regexes = [];
  walk.simple(ast, {
    Literal(node) {
      if (node.regex) regexes.push({ pattern: node.regex.pattern, flags: node.regex.flags, pos: node.start });
    },
    NewExpression(node) {
      if (node.callee.type === "Identifier" && node.callee.name === "RegExp" && node.arguments[0]?.type === "Literal" && typeof node.arguments[0].value === "string") {
        regexes.push({ pattern: node.arguments[0].value, flags: node.arguments[1]?.value ?? "", pos: node.start, ctor: true });
      }
    },
  });
  const bad = await page.evaluate((list) => list.flatMap((r) => { try { new RegExp(r.pattern, r.flags); return []; } catch (e) { return [{ ...r, error: String(e) }]; } }), regexes);
  console.log(`== ${basename(f)}: ${regexes.length} regexes, ${bad.length} rejected`);
  for (const b of bad) {
    console.log(`  @${b.pos} /${b.pattern}/${b.flags}${b.ctor ? " (new RegExp)" : ""} -> ${b.error}`);
    console.log(`    context: …${src.slice(Math.max(0, b.pos - 160), b.pos + 80)}…`);
  }
}
await browser.close();
