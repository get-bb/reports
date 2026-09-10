import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';
const require = createRequire(resolve('packages/provider-bridge-acp/package.json'));
const { Client } = await import(require.resolve('@modelcontextprotocol/sdk/client/index.js'));
const { StdioClientTransport } = await import(require.resolve('@modelcontextprotocol/sdk/client/stdio.js'));
const sockets = new Set();
let activeSocket;
let toolClosed = false;
const server = createServer(socket => {
  sockets.add(socket);
  socket.on('error', () => {});
  socket.on('close', () => { sockets.delete(socket); if (socket === activeSocket) toolClosed = true; });
  createInterface({ input: socket }).once('line', line => {
    const request = JSON.parse(line);
    if (request.kind === 'initialized') socket.end(JSON.stringify({ ok: true, content: '' }) + '\n');
    else activeSocket = socket;
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['--conditions=source', '--import', 'tsx', '--input-type=module', '-e',
    'import { runAcpDynamicToolMcpServer } from "./packages/provider-bridge-acp/src/bridge/tool-proxy-mcp.ts"; runAcpDynamicToolMcpServer();'],
  env: { ...process.env, BB_ACP_DYNAMIC_TOOL_HOST: '127.0.0.1',
    BB_ACP_DYNAMIC_TOOL_PORT: String(server.address().port), BB_ACP_DYNAMIC_TOOL_TOKEN: 'local-repro',
    BB_ACP_DYNAMIC_TOOL_THREAD_ID: 'repro-thread',
    BB_ACP_DYNAMIC_TOOLS: JSON.stringify([{ name: 'waitForInput', description: 'Wait for input', inputSchema: { type: 'object', properties: {} } }]) },
  stderr: 'pipe'
});
const client = new Client({ name: 'deadline-repro', version: '1' });
let lateResponseError;
client.onerror = error => { lateResponseError = error.message; };
try {
  await client.connect(transport);
  await assert.rejects(client.callTool({ name: 'waitForInput', arguments: {} }, undefined, { timeout: 300 }), error => {
    console.log('Client timeout code:', error.code);
    console.log('Client timeout message:', error.message);
    return error.code === -32001;
  });
  assert.ok(activeSocket, 'Tool must have reached the bridge before timeout');
  await delay(100);
  const cancelled = toolClosed;
  console.log('Bridge request cancelled after client timeout:', cancelled);
  activeSocket.end(JSON.stringify({ ok: true, content: 'late-answer' }) + '\n');
  await delay(200);
  console.log('Client handling of late answer:', lateResponseError);
  assert.equal(cancelled, true, 'Caller timeout must cancel the bridge request');
} finally {
  await client.close();
  for (const socket of sockets) socket.destroy();
  await new Promise(resolve => server.close(resolve));
}
