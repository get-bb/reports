// EXPERIMENT ONLY. Rewrites the two regex-lookbehind literals in the built
// workspace-checkout-display chunk (from @pierre/diffs and
// mdast-util-gfm-autolink-literal) so a Safari < 16.4 engine can parse the
// chunk, then we re-load the app in WebKit 16.0 to see what fails next.
// The replacements are NOT semantically exact (they only need to compile).
// Usage: node patch-lookbehind-experiment.mjs <apps/app/dist/assets> [restore]
import fs from "node:fs";
import path from "node:path";
const dir = process.argv[2];
const restore = process.argv[3] === "restore";
const files = fs.readdirSync(dir).filter((f) => /^workspace-checkout-display-.*\.js$/.test(f));
for (const f of files) {
  const p = path.join(dir, f);
  const bak = p + ".orig";
  if (restore) {
    if (fs.existsSync(bak)) { fs.copyFileSync(bak, p); fs.unlinkSync(bak); console.log("restored", f); }
    continue;
  }
  if (!fs.existsSync(bak)) fs.copyFileSync(p, bak);
  let s = fs.readFileSync(bak, "utf8");
  const before = (s.match(/\(\?<[=!]/g) || []).length;
  s = s.replace("/(?<=\\n)/", "/\\n/");
  s = s.replace("/(?<=^|\\s|\\p{P}|\\p{S})([-.\\w+]+)@", "/(?:^|\\s|\\p{P}|\\p{S})([-.\\w+]+)@");
  const after = (s.match(/\(\?<[=!]/g) || []).length;
  fs.writeFileSync(p, s);
  console.log(`${f}: lookbehind literals ${before} -> ${after}`);
}
