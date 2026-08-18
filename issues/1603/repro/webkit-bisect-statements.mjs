// Split a built chunk into top-level statements (acorn), then ask an old WebKit
// to *parse* each statement (via new Function) so parse-time errors such as
// unsupported regex literals are pinned to the exact statement.
// Usage: node webkit-bisect-statements.mjs <chunkFile>
import { webkit } from "playwright";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const acorn = require("acorn");
const [file] = process.argv.slice(2);
const src = readFileSync(file, "utf8");
const ast = acorn.parse(src, { ecmaVersion: "latest", sourceType: "module" });
const stmts = ast.body
  .filter((n) => n.type !== "ImportDeclaration" && !(n.type === "ExportNamedDeclaration" && !n.declaration) && n.type !== "ExportAllDeclaration")
  .map((n) => {
    const d = n.type === "ExportNamedDeclaration" || n.type === "ExportDefaultDeclaration" ? n.declaration : n;
    return { start: d.start, end: d.end, text: src.slice(d.start, d.end) };
  });
const browser = await webkit.launch();
const page = await browser.newPage();
await page.goto("about:blank");
console.log("UA:", await page.evaluate(() => navigator.userAgent), "statements:", stmts.length);
const bad = await page.evaluate((list) =>
  list.flatMap((s) => {
    try {
      new Function(s.text);
      return [];
    } catch (e) {
      return [{ start: s.start, end: s.end, error: String(e) }];
    }
  }), stmts);
for (const b of bad) {
  const text = src.slice(b.start, b.end);
  console.log(`== statement @${b.start}-${b.end} (${text.length} chars): ${b.error}`);
  // Narrow further: report every "(?<" occurrence in the statement with context.
  let i = -1;
  while ((i = text.indexOf("(?<", i + 1)) !== -1) {
    const ctx = text.slice(Math.max(0, i - 70), i + 70).replace(/\n/g, "\\n");
    console.log(`   (?< at +${i}: …${ctx}…`);
  }
}
await browser.close();
