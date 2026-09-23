import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const checkout = resolve(process.argv[2]);
const mode = process.argv[3] ?? 'generation';
const typescript = process.argv.includes('--typescript');
const extension = typescript ? 'ts' : 'js';
const source = readFileSync(join(checkout, 'apps/server/src/services/plugins/plugin-runtime.ts'), 'utf8');
const first = source.slice(source.indexOf('interface MutableRoot {'), source.indexOf('const PROVIDER_ICON_CONTENT_TYPES'));
const second = source.slice(source.indexOf('function mutableRootDir('), source.indexOf('type PluginDevBuildKind'));
const scratch = mkdtempSync(join(tmpdir(), 'bb-retention-'));
const loader = join(scratch, 'loader.mjs');
writeFileSync(loader, stripTypeScriptTypes(`import { realpathSync } from 'node:fs';\nimport { join } from 'node:path';\nimport { pathToFileURL } from 'node:url';\nimport { createRequire, registerHooks } from 'node:module';\n${first}\n${second}\nexport { bumpMutableRootGeneration };`, { mode: 'strip' }));
const { bumpMutableRootGeneration, forgetMutableRoot } = await import(pathToFileURL(loader).href);
const require = createRequire(join(checkout, 'apps/server/package.json'));
const { createJiti } = require('jiti');
const root = join(scratch, 'fixture');
const { mkdirSync } = await import('node:fs');
mkdirSync(root);
writeFileSync(join(root, 'package.json'), JSON.stringify({ type: 'module' }));
writeFileSync(join(root, `state.${extension}`), `export const state${typescript ? ': number[]' : ''} = Array.from({length: 262144}, (_, i) => i);\n`);
writeFileSync(join(root, `server.${extension}`), `import { state } from "./state.${extension}";\nexport default function plugin() { return state; }\n`);
const refs = [];
async function gc() {
  for (let i = 0; i < 8; i++) {
    await new Promise(resolve => setImmediate(resolve));
    global.gc();
  }
}
async function load() {
  if (mode === 'generation') bumpMutableRootGeneration(root);
  const jiti = createJiti(pathToFileURL(join(checkout, 'apps/server/src/services/plugins/plugin-runtime.ts')).href, { moduleCache: false });
  const mod = await jiti.import(join(root, `server.${extension}`));
  const state = mod.default();
  refs.push(new WeakRef(state));
}
try {
  console.log(JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch, mode, typescript }));
  await gc();
  const baseline = process.memoryUsage().heapUsed;
  for (let i = 0; i < 8; i++) {
    await load();
    await gc();
    console.log(JSON.stringify({ load: i + 1, heapGrowthMiB: Number(((process.memoryUsage().heapUsed - baseline) / 1048576).toFixed(2)) }));
  }
  forgetMutableRoot(root);
  await gc();
  const live = refs.map(ref => ref.deref()).filter(Boolean);
  const unique = new Set(live).size;
  console.log(JSON.stringify({ afterForget: true, liveReferences: live.length, uniqueRetainedStates: unique }));
  assert.equal(unique, typescript ? 0 : mode === 'generation' ? 8 : 1);
  if (process.argv.includes('--assert-reclaimed')) assert.equal(unique, 1, 'Disposed generations should not retain all prior module states');
} finally {
  forgetMutableRoot(root);
  rmSync(scratch, { recursive: true, force: true });
}
