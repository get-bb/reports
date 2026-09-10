import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';

const sockets = new Set();
let activeSocket;
let bridgeRequest;
let closedBeforeAnswer = false;
const bridge = createServer(socket => {
  sockets.add(socket);
  socket.on('error', () => {});
  socket.on('close', () => { sockets.delete(socket); closedBeforeAnswer = true; });
  createInterface({ input: socket }).once('line', line => {
    bridgeRequest = JSON.parse(line);
    activeSocket = socket;
  });
});
await new Promise(resolve => bridge.listen(0, '127.0.0.1', resolve));
const child = spawn(process.execPath, ['--conditions=source', '--import', 'tsx', '--input-type=module', '-e',
  'import { runAcpDynamicToolMcpServer } from "./packages/provider-bridge-acp/src/bridge/tool-proxy-mcp.ts"; runAcpDynamicToolMcpServer();'], {
  cwd: process.cwd(),
  env: { ...process.env, BB_ACP_DYNAMIC_TOOL_HOST: '127.0.0.1',
    BB_ACP_DYNAMIC_TOOL_PORT: String(bridge.address().port), BB_ACP_DYNAMIC_TOOL_TOKEN: 'local-repro',
    BB_ACP_DYNAMIC_TOOL_THREAD_ID: 'repro-thread',
    BB_ACP_DYNAMIC_TOOLS: JSON.stringify([{ name: 'waitForInput', description: 'Wait for input', inputSchema: { type: 'object', properties: {} } }]),
    BB_ACP_DYNAMIC_TOOL_PROGRESS_INTERVAL_MS: '50' },
  stdio: ['pipe', 'pipe', 'pipe']
});
const messages = [];
let errors = '';
child.stderr.on('data', chunk => { errors += chunk; });
createInterface({ input: child.stdout }).on('line', line => messages.push(JSON.parse(line)));
const send = value => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...value }) + '\n');
async function until(predicate) {
  const end = Date.now() + 10000;
  while (!predicate()) {
    if (Date.now() > end) throw new Error('Harness deadline exceeded: ' + errors);
    await delay(10);
  }
}
try {
  send({ id: 1, method: 'tools/call', params: { name: 'waitForInput', arguments: {} } });
  await until(() => bridgeRequest !== undefined);
  await delay(200);
  console.log('Progress without a requested token:', messages.filter(m => m.method === 'notifications/progress').length);
  send({ method: 'notifications/cancelled', params: { requestId: 1, reason: 'Local caller deadline elapsed' } });
  await delay(200);
  const cancelled = closedBeforeAnswer;
  console.log('Bridge socket closed after cancellation:', cancelled);
  activeSocket.end(JSON.stringify({ ok: true, content: 'late-answer' }) + '\n');
  await until(() => messages.some(m => m.id === 1));
  const late = messages.find(m => m.id === 1);
  console.log('Response after cancellation:', JSON.stringify(late));
  assert.equal(cancelled, true, 'Cancellation must reach the in-flight bridge request');
} finally {
  child.kill();
  for (const socket of sockets) socket.destroy();
  await new Promise(resolve => bridge.close(resolve));
}
