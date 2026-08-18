#!/usr/bin/env node
// Builds apps/app in memory and reports, for chunks whose name matches argv,
// the packages/modules inside (by rendered size) and which chunks import them
// statically vs dynamically.
// Run from apps/app: node /tmp/bb-reports/issues/1072/repro/chunk-composition.mjs workspace-checkout-display
import { build, loadConfigFromFile } from "vite";
import path from "node:path";
import process from "node:process";

const appDir = process.cwd();
const targets = process.argv.slice(2);
const loaded = await loadConfigFromFile(
  { command: "build", mode: "production" },
  path.join(appDir, "vite.config.ts"),
  appDir,
);
const cfg = loaded.config;
let bundle = null;
const grab = {
  name: "grab",
  generateBundle(_o, b) { bundle = b; },
};
await build({ ...cfg, root: appDir, logLevel: "error", plugins: [...cfg.plugins, grab],
  build: { ...cfg.build, write: false, outDir: "dist-graph" } });

const rel = (id) => path.relative(path.resolve(appDir, "../.."), id).replace(/^\.\.\//, "");
const pkgOf = (id) => {
  const m = id.lastIndexOf("node_modules/");
  if (m < 0) return "(app) " + rel(id).split("/").slice(0, 4).join("/");
  const seg = id.slice(m + 13).split("/");
  return seg[0].startsWith("@") ? seg[0] + "/" + seg[1] : seg[0];
};
for (const [file, out] of Object.entries(bundle)) {
  if (out.type !== "chunk") continue;
  if (!targets.some((t) => file.includes(t))) continue;
  console.log(`\n=== ${file}  ${(Buffer.byteLength(out.code)/1024).toFixed(0)} KB, ${Object.keys(out.modules).length} modules`);
  const byPkg = new Map();
  for (const [id, m] of Object.entries(out.modules)) {
    const k = pkgOf(id);
    byPkg.set(k, (byPkg.get(k) ?? 0) + m.renderedLength);
  }
  for (const [k, v] of [...byPkg].sort((a, b) => b[1] - a[1]).slice(0, 40))
    console.log(`  ${(v/1024).toFixed(0).padStart(6)} KB  ${k}`);
  console.log(`  facadeModuleId: ${out.facadeModuleId ? rel(out.facadeModuleId) : null}`);
  const staticImporters = [], dynImporters = [];
  for (const [f2, o2] of Object.entries(bundle)) {
    if (o2.type !== "chunk") continue;
    if (o2.imports.includes(file)) staticImporters.push(f2);
    if (o2.dynamicImports.includes(file)) dynImporters.push(f2);
  }
  console.log(`  static importers (${staticImporters.length}): ${staticImporters.slice(0,30).join(", ")}`);
  console.log(`  dynamic importers (${dynImporters.length}): ${dynImporters.slice(0,30).join(", ")}`);
  console.log(`  this chunk statically imports: ${out.imports.join(", ")}`);
}
