import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';

const root = resolve(process.argv[2] ?? '.');
const scratch = fs.mkdtempSync(join(tmpdir(), 'bb-3340-probe-'));
const launcher = fs.readFileSync(join(root, 'packages/bb-app/src/launcher.ts'), 'utf8');
const utilities = fs.readFileSync(join(root, 'packages/process-utils/src/index.ts'), 'utf8');
const restartSource = launcher.slice(launcher.indexOf('async function restartManagedProcess('), launcher.indexOf('export async function terminateManagedFullStackProcesses('));
assert.ok(restartSource.length > 100);
const retryConstant = launcher.match(/const MANAGED_PROCESS_RESTART_RETRY_DELAY_MS = [\d_]+;/)?.[0];
assert.ok(retryConstant);
const restart = runInNewContext(stripTypeScriptTypes(`${retryConstant}\n${restartSource}\nrestartManagedProcess`), {
  beginStep() {}, endStep() {}, logManagedProcessStartupFailureContext() {},
  formatManagedProcessLabel: x => x, formatManagedProcessName: x => x,
  green: x => x, red: x => x,
});
const diagnosticSource = utilities.slice(utilities.indexOf('function createCurrentDiagnosticDate('), utilities.indexOf('export function installSafeProcessDiagnostics(')).replace('export function ', 'function ');
assert.ok(diagnosticSource.length > 100);
const constants = utilities.match(/const MAX_DIAGNOSTIC_[A-Z_]+ = \d+;/g).join('\n');
function diagnosticWriter(writeFileSync) {
  return runInNewContext(stripTypeScriptTypes(`${constants}\n${diagnosticSource}\nwriteSafeProcessDiagnosticReport`), {
    mkdirSync: fs.mkdirSync, writeFileSync, join, randomUUID, process, Error, AggregateError,
  });
}
let failures = 0;
function check(name, test) {
  try { test(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.log(`FAIL ${name}: ${error.message}`); }
}
try {
  let attempts = 0;
  let safetyStop = false;
  const delays = [];
  const result = await restart({
    context: {}, processName: 'server', isShutdownRequested: () => safetyStop,
    start: async () => { attempts++; throw new Error('controlled startup failure'); },
    delayMilliseconds: async ({ms}) => { delays.push(ms); if (attempts === 32) safetyStop = true; },
  });
  console.log(JSON.stringify({attempts, delays, safetyStop, result}));
  check('repeated failures stop before the 32-attempt safety limit', () => assert.equal(safetyStop, false));
  check('retry delay increases', () => assert.ok(new Set(delays).size > 1));
  const normalDir = join(scratch, 'normal');
  const writer = diagnosticWriter(fs.writeFileSync);
  for (let i = 0; i < 32; i++) writer({ logsDir: normalDir, processName: 'server', kind: 'startupFailure', error: new Error('controlled startup failure') });
  const retained = fs.readdirSync(normalDir).length;
  console.log(JSON.stringify({successfulWrites: 32, retained}));
  check('retention removes older reports', () => assert.ok(retained < 32));
  const server = fs.readFileSync(join(root, 'apps/server/src/index.ts'), 'utf8');
  const startupSource = server.slice(server.indexOf('function reportStartupFailure('), server.indexOf('async function main('));
  const stderr = [];
  const fakeProcess = {stderr: {write: value => stderr.push(value)}, exitCode: undefined};
  const reportFailure = runInNewContext(stripTypeScriptTypes(`${startupSource}\nreportStartupFailure`), {
    writeSafeProcessDiagnosticReport() { throw new Error('controlled diagnostic failure'); },
    diagnosticsLogsDir: scratch, process: fakeProcess, Error,
  });
  const startupError = new Error('controlled startup failure');
  startupError.stack = 'Error: controlled startup failure';
  reportFailure(startupError);
  console.log(JSON.stringify({stderr, exitCode: fakeProcess.exitCode}));
  check('startup evidence survives diagnostic write failure', () => {
    assert.deepEqual(stderr, ['Error: controlled startup failure\n']);
    assert.equal(fakeProcess.exitCode, 1);
  });
  const failingDir = join(scratch, 'write-failure');
  const failedWriter = diagnosticWriter((path) => {
    fs.closeSync(fs.openSync(path, 'w'));
    throw Object.assign(new Error('controlled storage write failure'), {code: 'ENOSPC'});
  });
  for (let i = 0; i < 32; i++) {
    assert.throws(() => failedWriter({ logsDir: failingDir, processName: 'server', kind: 'startupFailure', error: new Error('controlled startup failure') }), {code: 'ENOSPC'});
  }
  const published = fs.readdirSync(failingDir);
  const empty = published.filter(name => fs.statSync(join(failingDir, name)).size === 0).length;
  console.log(JSON.stringify({failedWrites: 32, published: published.length, empty}));
  check('failed writes leave no published JSON files', () => assert.equal(published.filter(name => name.endsWith('.json')).length, 0));
} finally {
  fs.rmSync(scratch, {recursive: true, force: true});
}
console.log(`Failed safety assertions: ${failures}`);
process.exitCode = failures ? 1 : 0;
