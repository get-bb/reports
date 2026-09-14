import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { join } from 'node:path';
const root = process.argv[2];
const cli = readFileSync(join(root, 'apps/cli/src/commands/thread/actions.ts'), 'utf8');
const server = readFileSync(join(root, 'apps/server/src/services/threads/thread-send.ts'), 'utf8');
const cliFunction = cli.match(/function resolveSenderThreadId\([\s\S]*?\n\}/)?.[0];
const serverFunction = server.match(/export function resolveMessageSenderThreadId\([\s\S]*?\n\}/)?.[0];
const initiator = server.match(/const initiator: ThreadTurnInitiator\s*=\s*[^;]+;/)?.[0];
assert.ok(cliFunction && serverFunction && initiator, 'source anchors must match');
function evaluate(source, context) {
  return vm.runInNewContext(stripTypeScriptTypes(source), context);
}
const cases = [
  ['service without thread context', undefined, undefined],
  ['human CLI without thread context', undefined, undefined],
  ['retry', undefined, { requestId: 'earlier-request', attempt: 2 }],
];
const results = [];
for (const [name, contextThreadId, retryOf] of cases) {
  const sender = evaluate(`${cliFunction}\nresolveSenderThreadId('target-thread')`, {
    resolveContextThreadId: () => contextThreadId,
  });
  const senderThreadId = evaluate(`${serverFunction.replace('export ', '')}\nresolveMessageSenderThreadId({}, args)`, {
    args: { senderThreadId: sender, targetThread: { id: 'target-thread' } },
    getThread: () => { throw new Error('database path excluded from this bounded probe'); },
  });
  results.push({ name, senderThreadId, initiator: evaluate(`${initiator}\ninitiator`, { senderThreadId, args: { retryOf } }) });
}
console.log(JSON.stringify(results, null, 2));
assert.deepEqual(results.map(({ name, ...value }) => value), [
  { senderThreadId: null, initiator: 'user' },
  { senderThreadId: null, initiator: 'user' },
  { senderThreadId: null, initiator: 'system' },
]);
console.log('Observed fallback confirmed; live routing and persistence were not exercised.');
