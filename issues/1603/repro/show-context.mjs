// Print context around occurrences of a needle in a (minified) file.
// Usage: node show-context.mjs <file> <needle> [max=5] [radius=120]
import { readFileSync } from "node:fs";
const [file, needle, max = "5", radius = "120"] = process.argv.slice(2);
const s = readFileSync(file, "utf8");
let i = -1, n = 0;
while ((i = s.indexOf(needle, i + 1)) !== -1 && n < Number(max)) {
  const a = Math.max(0, i - Number(radius)), b = Math.min(s.length, i + needle.length + Number(radius));
  console.log(`@${i}: …${s.slice(a, b)}…\n`);
  n++;
}
console.log(`total occurrences: ${s.split(needle).length - 1}`);
