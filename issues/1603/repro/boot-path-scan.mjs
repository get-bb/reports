// Usage: node boot-path-scan.mjs <apps/app/dist>
// Follows static imports from the entry chunk and reports Safari<16.4-hostile syntax per chunk.
import fs from "node:fs";
import path from "node:path";
const dist = process.argv[2];
const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const entry = html.match(/<script type="module"[^>]*src="\/assets\/([^"]+)"/)[1];
const seen = new Map();
const queue = [entry];
while (queue.length) {
  const f = queue.shift();
  if (seen.has(f)) continue;
  const src = fs.readFileSync(path.join(dist, "assets", f), "utf8");
  const staticImports = [...src.matchAll(/(?:^|[;{}\s])import\s*(?:[^;'"]*?from\s*)?["']\.\/([^"']+)["']/g)].map(m => m[1]);
  const dynImports = [...src.matchAll(/import\(["']\.\/([^"']+)["']\)/g)].map(m => m[1]);
  seen.set(f, {
    bytes: src.length,
    staticBlocks: (src.match(/static\s*\{/g) || []).length,
    lookbehind: (src.match(/\(\?<[=!]/g) || []).length,
    checkVisibility: (src.match(/checkVisibility\(/g) || []).length,
    toSorted: (src.match(/\.toSorted\(/g) || []).length,
    urlCanParse: (src.match(/URL\.canParse/g) || []).length,
    iterHelpers: (src.match(/\.(values|keys|entries)\(\)\.(map|filter|find|some|every|flatMap|reduce|forEach|take|drop|toArray)\(/g) || []).length,
    staticImports, dynImports,
  });
  queue.push(...staticImports.filter(x => !seen.has(x)));
}
let tot = { staticBlocks: 0, lookbehind: 0 };
for (const [f, s] of seen) {
  tot.staticBlocks += s.staticBlocks; tot.lookbehind += s.lookbehind;
  console.log(`${f}\tbytes=${s.bytes}\tstatic{=${s.staticBlocks}\tlookbehind=${s.lookbehind}\tcheckVisibility=${s.checkVisibility}\ttoSorted=${s.toSorted}\tURL.canParse=${s.urlCanParse}\titerHelpers=${s.iterHelpers}`);
}
console.log(`\nboot-path chunks: ${seen.size}; static{ total=${tot.staticBlocks}; lookbehind total=${tot.lookbehind}`);
