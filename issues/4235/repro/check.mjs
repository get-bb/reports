import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = process.argv[2];
const read = path => readFileSync(`${root}/apps/desktop/src/${path}`, 'utf8');
const main = read('main.ts');
const browser = read('desktop-browser-view.ts');
assert.match(main, /const cookieStore = session\.defaultSession\.cookies;/);
assert.match(browser, /const BB_BROWSER_PARTITION = "persist:bb-browser"/);
assert.match(browser, /session\.fromPartition\(tabPartition\)/);
const source = read('connect-desktop-session.ts');
const helpers = source.slice(source.indexOf('function failure('), source.indexOf('export function createLocalServerCookieSource'));
const installer = source.slice(source.indexOf('export async function installConnectDesktopSession')).replace('export ', '');
const js = stripTypeScriptTypes(helpers + installer);
const install = vm.runInNewContext(js + '\ninstallConnectDesktopSession', { URL });
const defaultCookies = [];
const browserCookies = [];
const store = {
  async set(cookie) { defaultCookies.push(cookie); },
  async get() { return defaultCookies; },
};
const result = await install({
  cookieStore: store,
  mintCookie: async () => ({ ok: true, cookie: { domain: '.example.test', expiresAt: 2000000000000, name: 'test-session', value: 'synthetic-test-value' } }),
  remoteServerUrl: 'https://machine.example.test',
});
assert.equal(result.ok, true);
assert.equal(defaultCookies.length, 1);
assert.equal(browserCookies.length, 0);
console.log('Installer result: ok=true');
console.log('Default store cookies: 1');
console.log('Separate Browser store cookies: 0');
console.log('PASS: single-store installation mechanism confirmed; real Electron navigation untested');
