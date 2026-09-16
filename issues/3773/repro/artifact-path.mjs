import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { createBbAppArtifactService } from '../../src/services/install/bb-app-artifact.ts';

const exec = promisify(execFile);
const require = createRequire(import.meta.url);
const npmCli = join(dirname(require.resolve('npm/package.json')), 'bin/npm-cli.js');
const root = await mkdtemp(join(tmpdir(), 'artifact-path-check-'));
const originalPath = process.env.PATH;
try {
  const packageRoot = join(root, 'runtime');
  for (const directory of ['dist', 'server/dist', 'host-daemon/dist/bb-chunks']) {
    await mkdir(join(packageRoot, directory), { recursive: true });
  }
  await writeFile(join(packageRoot, 'package.json'), JSON.stringify({
    name: 'bb-app', version: '1.0.0', type: 'module', os: ['darwin', 'linux'],
    engines: { node: '>=22.19.0' },
    dependencies: {
      '@parcel/watcher': '2.5.6', 'fs-native-extensions': '1.5.0',
      'node-pty': '1.2.0-beta.15', pino: '9.6.0',
      'pino-pretty': '13.0.0', 'pino-roll': '4.0.0',
    },
  }));
  for (const file of ['bb.js', 'bb-app.js', 'bb-host-daemon.js']) {
    await writeFile(join(packageRoot, 'dist', file), 'export {};\n');
  }
  for (const file of ['bb', 'bb-parcel-watcher-child.mjs', 'bb-plugin-host-worker.mjs',
    'bb-provider-bridge-worker.mjs', 'daemon-bundle.mjs']) {
    await writeFile(join(packageRoot, 'host-daemon/dist', file), 'export {};\n');
  }
  await writeFile(join(packageRoot, 'host-daemon/dist/bb-chunks/runtime.js'), 'export {};\n');
  process.env.PATH = '/usr/bin:/bin:/usr/sbin:/sbin';
  const npmVersion = await exec(process.execPath, [npmCli, '--version']);
  console.log(`Bundled npm via absolute Node path: ${npmVersion.stdout.trim()}`);
  const serverEntryUrl = pathToFileURL(join(packageRoot, 'server/dist/index.js')).href;
  const control = createBbAppArtifactService({
    dataDir: join(root, 'control'), serverEntryUrl,
    commandRunner: async (command, args, cwd) => {
      assert.equal(command, 'npm');
      return (await exec(process.execPath, [npmCli, ...args], { cwd })).stdout;
    },
  });
  const controlArtifact = await control.getArtifact();
  assert.ok(controlArtifact.size > 0);
  console.log('Control: same fixture packs successfully using absolute npm CLI');
  const service = createBbAppArtifactService({ dataDir: join(root, 'default'), serverEntryUrl });
  try {
    const artifact = await service.getArtifact();
    assert.ok(artifact.size > 0);
    console.log('PASS: default runner produced an artifact without npm on PATH');
  } catch (error) {
    console.log(`FAIL: default runner: ${error.message}`);
    console.log(`code=${error.code}; syscall=${error.syscall}; executable=${error.path}`);
    process.exitCode = 1;
  }
} finally {
  if (originalPath === undefined) delete process.env.PATH;
  else process.env.PATH = originalPath;
  await rm(root, { recursive: true, force: true });
}
