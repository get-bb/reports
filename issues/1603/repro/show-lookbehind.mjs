// Print every "(?<=" / "(?<!" occurrence in a file with surrounding context.
// Usage: node show-lookbehind.mjs <file>
import fs from "node:fs";
const s = fs.readFileSync(process.argv[2], "utf8");
const re = /\(\?<[=!]/g;
let m;
while ((m = re.exec(s))) {
  console.log(`@${m.index}: …${s.slice(Math.max(0, m.index - 140), m.index + 80).replace(/\n/g, "\\n")}…\n`);
}
