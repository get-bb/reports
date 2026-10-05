import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { tmpdir } from 'node:os';

const checkout = path.resolve(process.argv[2]);

if (process.argv[3] === 'child') {
  const { createNodeWebSocketConstructor } = await import(pathToFileURL(path.join(checkout, 'apps/host-daemon/src/websocket-constructor.ts')));
  const { startMachineAuthProxy } = await import(pathToFileURL(path.join(checkout, 'apps/host-daemon/src/machine-auth-proxy.ts')));
  function requestResult(client, url, options = {}) {
    return new Promise((resolve) => {
      const request = client.get(url, { ...options, timeout: 3000 }, (response) => {
        response.resume();
        response.on('end', () => resolve('status ' + response.statusCode));
      });
      request.on('timeout', () => request.destroy(new Error('timeout')));
      request.on('error', (error) => resolve(error.code ?? error.message));
    });
  }
  const results = {};
  results.httpControl = await requestResult(http, 'http://http-control.slopcop-4957.invalid/');
  results.httpsControl = await requestResult(https, 'https://https-control.slopcop-4957.invalid/');
  for (const protocol of ['ws', 'wss']) {
    for (const variant of ['bare', 'headers']) {
      const WebSocket = createNodeWebSocketConstructor(variant === 'headers' ? { 'x-repro': 'synthetic' } : undefined);
      results[protocol + '-' + variant] = await new Promise((resolve) => {
        const socket = new WebSocket(protocol + '://' + variant + '-' + protocol + '.slopcop-4957.invalid/');
        const timer = setTimeout(() => { socket.terminate(); resolve('timeout'); }, 3000);
        socket.once('open', () => { clearTimeout(timer); socket.close(); resolve('open'); });
        socket.once('error', (error) => { clearTimeout(timer); resolve(error.code ?? error.message); });
      });
    }
  }
  const machineProxy = await startMachineAuthProxy({ serverHeaders: {}, serverUrl: 'http://machine-auth.slopcop-4957.invalid' });
  try {
    results.machineAuthHttp = await requestResult(http, machineProxy.serverUrl, { agent: false });
  } finally {
    await machineProxy.close();
  }
  console.log(JSON.stringify(results));
} else {
  const proxyRequests = [];
  const sockets = new Set();
  const proxy = http.createServer((request, response) => {
    proxyRequests.push(request.url);
    response.writeHead(200).end('synthetic proxy response');
  });
  proxy.on('connect', (request, socket) => {
    proxyRequests.push('CONNECT ' + request.url);
    socket.end('HTTP/1.1 503 Synthetic tunnel rejection\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');
  });
  proxy.on('connection', (socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
  const port = proxy.address().port;
  const dataDir = await mkdtemp(path.join(tmpdir(), 'bb-4957-repro-'));
  const require = createRequire(path.join(checkout, 'package.json'));
  const child = spawn(process.execPath, ['--import', require.resolve('tsx'), import.meta.filename, checkout, 'child'], {
    cwd: checkout,
    env: { ...process.env, HTTP_PROXY: 'http://127.0.0.1:' + port, HTTPS_PROXY: 'http://127.0.0.1:' + port, ALL_PROXY: '', http_proxy: '', https_proxy: '', all_proxy: '', NO_PROXY: '127.0.0.1,localhost,::1', no_proxy: '', NODE_USE_ENV_PROXY: '1', NODE_OPTIONS: '', BB_DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let errors = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { errors += chunk; });
  const exitCode = await new Promise((resolve) => child.once('exit', resolve));
  for (const socket of sockets) socket.destroy();
  await new Promise((resolve) => proxy.close(resolve));
  await rm(dataDir, { recursive: true, force: true });
  assert.equal(exitCode, 0, errors);
  const results = JSON.parse(output.trim());
  console.log('runtime: ' + process.version);
  console.log('proxy port: ' + port);
  console.log(JSON.stringify({ results, proxyRequests }, null, 2));
  assert.equal(results.httpControl, 'status 200');
  assert.ok(proxyRequests.some((request) => request.includes('https-control')));
  assert.equal(results.machineAuthHttp, 'status 200');
  const websocketProxyRequests = proxyRequests.filter((request) => /(?:bare|headers)-(?:ws|wss)/.test(request));
  console.log('WebSocket requests reaching declared proxy: ' + websocketProxyRequests.length + '/4');
  assert.equal(websocketProxyRequests.length, 4, 'daemon WebSocket dials must reach the declared proxy instead of resolving the synthetic host directly');
}
