#!/usr/bin/env node
// Issue #1072 repro. For a chunk (by substring, e.g. the thread route
// SplitWorkspaceRoute), prints the transitive static-import closure — every
// chunk the browser must fetch+parse before that route can render — with
// sizes, minus what the HTML shell already preloads, and lists the heavy
// packages found in that closure. Exits 1 when any of the packages that
// bundle-budget.json forbids on the *boot* path is on the *thread route* path.
// Run from apps/app: node scripts/route-closure.mjs SplitWorkspaceRoute
import { build, loadConfigFromFile } from "vite";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const appDir = process.cwd();
const targets = process.argv.slice(2);
const budget = JSON.parse(readFileSync(path.join(appDir, "bundle-budget.json"), "utf8"));
const forbidden = new Set(budget.forbiddenBootPackages);
const loaded = await loadConfigFromFile({ command: "build", mode: "production" }, path.join(appDir, "vite.config.ts"), appDir);
const cfg = loaded.config;
let bundle = null;
await build({ ...cfg, root: appDir, logLevel: "error",
  plugins: [...cfg.plugins, { name: "grab", generateBundle(_o, b) { bundle = b; } }],
  build: { ...cfg.build, write: false, outDir: "dist-graph" } });

const chunks = Object.values(bundle).filter((o) => o.type === "chunk");
const entry = chunks.find((c) => c.isEntry);
const closure = (start) => {
  const seen = new Set();
  const walk = (f) => { if (seen.has(f)) return; seen.add(f); for (const i of bundle[f]?.imports ?? []) walk(i); };
  walk(start);
  return seen;
};
const pkgOf = (id) => {
  const m = id.lastIndexOf("node_modules/");
  if (m < 0) return null;
  const seg = id.slice(m + 13).split("/");
  return seg[0].startsWith("@") ? `${seg[0]}/${seg[1]}` : seg[0];
};
const boot = closure(entry.fileName);
const size = (f) => Buffer.byteLength(bundle[f].code);
const sum = (set) => [...set].reduce((a, f) => a + size(f), 0);
console.log(`boot closure (HTML modulepreload set): ${boot.size} chunks, ${(sum(boot)/1024).toFixed(0)} KB`);
let bad = false;
for (const t of targets) {
  const c = chunks.find((c) => c.fileName.includes(t));
  if (!c) { console.log(`no chunk matches ${t}`); continue; }
  const cl = closure(c.fileName);
  const extra = [...cl].filter((f) => !boot.has(f));
  console.log(`\n=== ${c.fileName}: static closure ${cl.size} chunks, ${(sum(cl)/1024).toFixed(0)} KB; beyond boot: ${extra.length} chunks, ${(sum(new Set(extra))/1024).toFixed(0)} KB`);
  for (const f of extra.sort((a, b) => size(b) - size(a))) console.log(`  ${(size(f)/1024).toFixed(0).padStart(6)} KB  ${f}`);
  const pkgBytes = new Map();
  for (const f of extra) for (const [id, m] of Object.entries(bundle[f].modules)) {
    const p = pkgOf(id); if (p) pkgBytes.set(p, (pkgBytes.get(p) ?? 0) + m.renderedLength);
  }
  const hits = [...pkgBytes].filter(([p]) => forbidden.has(p)).sort((a, b) => b[1] - a[1]);
  console.log(`  forbiddenBootPackages present on this route's static path (${hits.length}):`);
  for (const [p, b] of hits) console.log(`    ${(b/1024).toFixed(0).padStart(6)} KB  ${p}`);
  if (hits.length > 0) bad = true;
}
process.exit(bad ? 1 : 0);
