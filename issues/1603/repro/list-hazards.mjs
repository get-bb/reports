// Usage: node list-hazards.mjs <apps/app/dist>
// Lists built chunks containing class static blocks (Safari 16.4+) or regex lookbehind (Safari 16.4+).
import fs from "node:fs";
import path from "node:path";
const dir = path.join(process.argv[2], "assets");
const rows = [];
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith(".js")) continue;
  const s = fs.readFileSync(path.join(dir, f), "utf8");
  const sb = (s.match(/static\s*\{/g) || []).length;
  const lb = (s.match(/\(\?<[=!]/g) || []).length;
  if (sb || lb) rows.push([f, s.length, sb, lb]);
}
rows.sort((a, b) => b[2] - a[2] || b[3] - a[3]);
console.log("file\tbytes\tstatic{\tlookbehind");
for (const r of rows.slice(0, 60)) console.log(r.join("\t"));
console.log("files with hazards:", rows.length);
