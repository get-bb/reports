// List which built chunks statically/dynamically reference the given chunk name
// prefixes, and where each lookbehind literal appears (excluding Shiki grammar data).
// Usage: node chunk-importers.mjs <apps/app/dist/assets> <chunkPrefix> [...]
import fs from "node:fs";
import path from "node:path";
const [dir, ...prefixes] = process.argv.slice(2);
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js"));
const contents = new Map(files.map((f) => [f, fs.readFileSync(path.join(dir, f), "utf8")]));
for (const p of prefixes) {
  const targets = files.filter((f) => f.startsWith(p + "-"));
  for (const t of targets) {
    console.log(`== ${t}: imported by`);
    for (const [f, s] of contents) {
      if (f === t) continue;
      const i = s.indexOf(t);
      if (i !== -1) {
        const isDynamic = /import\(\s*$/.test(s.slice(Math.max(0, i - 40), i).replace(/["'`\.\/]+$/, "").trimEnd() + "(");
        console.log(`   ${f}${/(?:import\(|__vitePreload|,\s*\(\)\s*=>\s*import)/.test(s.slice(Math.max(0, i - 60), i)) ? "  (dynamic)" : ""}`);
      }
    }
  }
}
console.log("\n== lookbehind literals in non-grammar chunks:");
for (const [f, s] of contents) {
  if (s.includes("scopeName")) continue; // Shiki TextMate grammars: strings for oniguruma, harmless
  const re = /\(\?<[=!]/g;
  let m;
  while ((m = re.exec(s))) {
    console.log(`   ${f} @${m.index}: …${s.slice(Math.max(0, m.index - 60), m.index + 60).replace(/\n/g, "\\n")}…`);
  }
}
