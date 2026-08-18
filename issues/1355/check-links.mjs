import fs from "node:fs";
const html = fs.readFileSync("/tmp/bb-reports/issues/1355.html", "utf8");
const refs = [...html.matchAll(/(?:href|src)="((?:1355\/|assets\/)[^"]+)"/g)].map((m) => m[1]);
for (const r of new Set(refs)) {
  const p = "/tmp/bb-reports/issues/" + r;
  console.log(fs.existsSync(p) ? "ok      " : "MISSING ", r);
}
console.log("imgs:", (html.match(/<img/g) || []).length);
