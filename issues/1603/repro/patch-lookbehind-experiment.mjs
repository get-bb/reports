// EXPERIMENT ONLY. Rewrites the three regex-lookbehind literals in the built
// workspace-checkout-display and worker-portable chunks (from @pierre/diffs'
// SPLIT_WITH_NEWLINES and mdast-util-gfm-autolink-literal's email matcher) so a
// Safari < 16.4 engine can parse the chunks, then re-load the app in WebKit 16.0
// to prove those literals are the only thing keeping the app from booting.
// The replacements are NOT semantically exact (they only need to compile).
// Usage: node patch-lookbehind-experiment.mjs <served dist/assets dir> [restore] [--unfold]
// NOTE: bb-app serves packages/bb-app/app/dist (a copy of apps/app/dist) and prefers the
// precompressed .br/.gz siblings, so patch that directory and move the .br/.gz files aside.
import fs from "node:fs";
import path from "node:path";
const dir = process.argv[2];
const restore = process.argv[3] === "restore";
const files = fs
  .readdirSync(dir)
  .filter((f) => /^(workspace-checkout-display|worker-portable)-.*\.js$/.test(f));
for (const f of files) {
  const p = path.join(dir, f);
  const bak = p + ".orig";
  if (restore) {
    if (fs.existsSync(bak)) {
      fs.copyFileSync(bak, p);
      fs.unlinkSync(bak);
      console.log("restored", f);
    }
    continue;
  }
  if (!fs.existsSync(bak)) fs.copyFileSync(p, bak);
  let s = fs.readFileSync(bak, "utf8");
  const count = (x) => (x.match(/=\/\(\?<=\\n\)\/|\/\(\?<=\^\|\\s/g) || []).length;
  const before = count(s);
  s = s.replaceAll("=/(?<=\\n)/", "=/\\n/");
  s = s.replace("/(?<=^|\\s|\\p{P}|\\p{S})([-.\\w+]+)@", "/(?:^|\\s|\\p{P}|\\p{S})([-.\\w+]+)@");
  // Step 2 (optional, --unfold): restore oniguruma-to-es's runtime feature detection that
  // rolldown constant-folded to `true` (see fold-check.mjs). On Safari < 17 the folded
  // `RegExp("[[^a]]","v")` throws "Invalid flags supplied to RegExp constructor" at load.
  if (process.argv.includes("--unfold")) {
    s = s.replaceAll(
      "{flagGroups:!0,unicodeSets:!0}",
      "{flagGroups:(()=>{try{new RegExp(`(?i:)`)}catch{return!1}return!0})(),unicodeSets:(()=>{try{new RegExp(`[[]]`,`v`)}catch{return!1}return!0})()}",
    );
  }
  const after = count(s);
  fs.writeFileSync(p, s);
  console.log(`${f}: real lookbehind literals ${before} -> ${after}`);
}
