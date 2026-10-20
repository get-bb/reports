import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const checkout = resolve(process.argv[2] ?? '.');
const dataDir = await mkdtemp(join(tmpdir(), 'bb-error-metadata-'));
const requests = [];
const server = createServer((request, response) => {
  requests.push({ method: request.method, path: request.url });
  response.writeHead(409, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'Fixture rejects this operation', code: 'fixture_refusal' }));
});
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const address = server.address();
assert(address !== null && typeof address !== 'string');
const execFileAsync = promisify(execFile);

async function invoke(args) {
  const env = {
    PATH: process.env.PATH,
    HOME: dataDir,
    TMPDIR: dataDir,
    BB_DATA_DIR: dataDir,
    BB_CLI_ERROR_LOG: '0',
    BB_CLI_REEXEC: '1',
    BB_SERVER_URL: 'http://127.0.0.1:' + address.port,
  };
  let result;
  try {
    result = { ...await execFileAsync(process.execPath, ['apps/cli/dist/index.js', ...args], { cwd: checkout, env, timeout: 15000 }), exitCode: 0 };
  } catch (error) {
    if (typeof error.code !== 'number') throw error;
    result = { exitCode: error.code, stdout: error.stdout, stderr: error.stderr };
  }
  return { exitCode: result.exitCode, envelope: JSON.parse(result.stdout), stderr: result.stderr.trim() };
}

try {
  const unwrapped = await invoke(['thread', 'list', '--json']);
  const wrapped = await invoke(['thread', 'archive', 'thr_metadata_fixture', '--json']);
  const observation = { unwrapped, wrapped, requests };
  console.log(JSON.stringify(observation, null, 2));
  assert.equal(unwrapped.exitCode, 1);
  assert.equal(unwrapped.envelope.error.code, 'fixture_refusal');
  assert.equal(wrapped.exitCode, 1);
  assert.match(wrapped.envelope.error.message, /^Failed to archive thread thr_metadata_fixture:/);
  assert.equal(wrapped.envelope.error.code, 'fixture_refusal', 'Context must preserve the SDK error code');
} finally {
  await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
  await rm(dataDir, { recursive: true, force: true });
}
