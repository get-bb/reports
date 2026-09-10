import assert from 'node:assert/strict';
import net from 'node:net';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { ServerConnection } from './src/server-connection.js';
import { readHostFile } from './src/command-handlers/host-files.js';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const dir = await mkdtemp(path.join(tmpdir(), 'bb-3407-data-'));
const sockets = new Set<net.Socket>();
const intervals = new Set<ReturnType<typeof setInterval>>();
const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
await once(server, 'listening');
const address = server.address();
assert(address && typeof address !== 'string');
let slow = false;
let backlog = 0;
let replies = 0;
let heartbeats = 0;
let timeouts = 0;
let heartbeatsAtTimeout = 0;
server.on('connection', ws => ws.on('message', data => {
  const message = JSON.parse(data.toString());
  if (message.type === 'heartbeat') {
    heartbeats++;
    ws.send(JSON.stringify({ type: 'heartbeat-ack' }));
  }
  if (message.type === 'host-rpc.response') replies++;
}));
const relay = net.createServer(client => {
  const upstream = net.connect(address.port, '127.0.0.1');
  sockets.add(client); sockets.add(upstream);
  const queue: Buffer[] = [];
  client.on('error', () => {}); upstream.on('error', () => {});
  upstream.pipe(client);
  client.on('data', data => {
    if (!slow) upstream.write(data);
    else { queue.push(data); backlog += data.length; }
  });
  const timer = setInterval(() => {
    let budget = 16384;
    while (queue.length && budget > 0) {
      const chunk = queue[0];
      const length = Math.min(chunk.length, budget);
      upstream.write(chunk.subarray(0, length));
      backlog -= length; budget -= length;
      if (length === chunk.length) queue.shift();
      else queue[0] = chunk.subarray(length);
    }
  }, 250);
  intervals.add(timer);
});
relay.listen(0, '127.0.0.1');
await once(relay, 'listening');
const relayAddress = relay.address();
assert(relayAddress && typeof relayAddress !== 'string');
const connection = new ServerConnection({
  serverUrl: `http://127.0.0.1:${relayAddress.port}`, hostKey: 'synthetic-key',
  hostId: 'synthetic-host', hostName: 'synthetic-host', hostType: 'persistent',
  dataDir: dir, instanceId: 'synthetic-instance', localApiPort: null,
  logger: { debug() {}, info() {}, error() {}, warn(fields, message) {
    if (message === 'Server heartbeat acknowledgements stopped; reconnecting') { timeouts++; heartbeatsAtTimeout = heartbeats; }
  } },
  serverClient: {
    async openSession() { return {
      heartbeatIntervalMs: 5000, leaseTimeoutMs: 30000, sessionId: 'synthetic-session',
      retiredEnvironmentIds: [], connectShares: { generation: 0, ports: [] },
      pluginHostGenerations: [], watchSet: { generation: 0, threadStorageTargets: [], workspaceTargets: [] },
    }; },
    async fetchProjectAttachment() { throw Error('unused'); },
    async fetchSkillTree() { throw Error('unused'); },
    async fetchPluginHostArtifact() { throw Error('unused'); },
    async postEvents() { throw Error('unused'); },
    async callTool() { throw Error('unused'); },
    async registerInteractiveRequest() { throw Error('unused'); },
    async interruptInteractiveRequests() { throw Error('unused'); },
  },
});
try {
  const file = path.join(dir, 'synthetic.html');
  await writeFile(file, '<!doctype html>' + 'a'.repeat(3 * 1024 * 1024));
  const result = await readHostFile({ type: 'host.read_file', path: file, rootPath: dir });
  await connection.start();
  const send = (requestId: string) => connection.sendMessage({
    type: 'host-rpc.response', requestId, commandType: 'host.read_file', ok: true, result,
  });
  assert(send('control'));
  await sleep(6000);
  assert.equal(replies, 1); assert(heartbeats >= 1); assert.equal(timeouts, 0);
  console.log(JSON.stringify({ phase: 'fast-control', fileBytes: result.sizeBytes, replies, heartbeats, timeouts }));
  slow = true;
  assert(send('slow-one')); assert(send('slow-two'));
  const heartbeatBefore = heartbeats;
  await sleep(35000);
  console.log(JSON.stringify({ phase: '64-KiB-per-second', backlog, replies, heartbeats, heartbeatsAtTimeout, timeouts }));
  assert.equal(replies, 1); assert.equal(heartbeatsAtTimeout, heartbeatBefore); assert(timeouts >= 1); assert(backlog > 0);
} finally {
  await connection.shutdown();
  for (const timer of intervals) clearInterval(timer);
  for (const socket of sockets) socket.destroy();
  for (const socket of server.clients) socket.terminate();
  await new Promise<void>(resolve => relay.close(() => resolve()));
  await new Promise<void>(resolve => server.close(() => resolve()));
  await rm(dir, { recursive: true, force: true });
}
