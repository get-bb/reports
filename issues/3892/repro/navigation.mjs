import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { EventEmitter } from 'node:events';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';

const source = readFileSync('apps/desktop/src/main.ts', 'utf8');
const start = source.indexOf('function registerApplicationRendererReloadShortcut(');
const end = source.indexOf('\nfunction ', start + 1);
assert(start >= 0 && end > start);
const registration = stripTypeScriptTypes(source.slice(start, end));
const scenarios = [
  { name: 'keyboard reload control', keyboard: true, expected: 1 },
  { name: 'main-frame new document', details: { isMainFrame: true, isSameDocument: false }, expected: 1 },
  { name: 'main-frame same document', details: { isMainFrame: true, isSameDocument: true }, expected: 0 },
  { name: 'subframe new document', details: { isMainFrame: false, isSameDocument: false }, expected: 0 },
];
let failures = 0;
for (const scenario of scenarios) {
  const renderer = new EventEmitter();
  let hides = 0;
  let reloads = 0;
  const hostWindow = { id: 1 };
  renderer.reload = () => { reloads += 1; };
  renderer.reloadIgnoringCache = renderer.reload;
  const register = runInNewContext(`${registration}\nregisterApplicationRendererReloadShortcut`, {
    resolveDesktopReloadShortcut: () => 'reload',
    resolveApplicationWindow: () => hostWindow,
    desktopBrowserViewManager: { prepareWindowReload(window) { assert.equal(window, hostWindow); hides += 1; } },
  });
  register(renderer);
  if (scenario.keyboard) {
    renderer.emit('before-input-event', { preventDefault() {} }, {});
    assert.equal(reloads, 1);
  } else {
    renderer.emit('did-start-navigation', scenario.details);
  }
  const passed = hides === scenario.expected;
  console.log(`${passed ? 'PASS' : 'FAIL'} ${scenario.name}: expected hide calls=${scenario.expected}, actual=${hides}`);
  if (!passed) failures += 1;
}
process.exitCode = failures ? 1 : 0;
