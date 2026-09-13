import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const checkout = process.cwd();
const { executeStoredScript, mapScriptResultToRun } = await import(pathToFileURL(join(checkout, 'plugins/automations/src/script-runner.ts')).href);
const { writeInlineAutomationScript } = await import(pathToFileURL(join(checkout, 'plugins/automations/src/script-files.ts')).href);
const scratch = await realpath(await mkdtemp(join(tmpdir(), 'automation-cwd-probe-')));
const project = join(scratch, 'project');
const pluginDataDir = join(scratch, 'plugin');
try {
  await mkdir(project);
  const shim = join(scratch, 'bb');
  await writeFile(shim, '#!/bin/sh\nexit 0\n', { mode: 0o700 });
  process.env.BB_CLI = shim;
  process.env.PATH = '/usr/bin:/bin';
  await writeFile(join(project, 'fixture.txt'), 'fixture found\n');
  process.chdir(project);
  const scriptFile = await writeInlineAutomationScript({dataDir: pluginDataDir, automationId: 'probe', content: 'pwd\ncat fixture.txt\n'});
  const args = {pluginDataDir, automationId: 'probe', runId: 'probe-run', projectId: 'probe-project', scriptFile, interpreter: 'bash', timeoutMs: 3000, serverUrl: 'http://127.0.0.1:1'};
  const relative = await executeStoredScript(args);
  const relativeRun = mapScriptResultToRun(relative);
  assert.equal(relative.output.split('\n')[0], join(pluginDataDir, 'scripts'));
  assert.match(relative.output, /fixture.txt: No such file or directory/);
  assert.equal(relativeRun.error, 'Script exited with code 1');
  const absoluteFile = await writeInlineAutomationScript({dataDir: pluginDataDir, automationId: 'probe', content: 'cat "$PROBE_PROJECT/fixture.txt"\n'});
  const absolute = await executeStoredScript({...args, scriptFile: absoluteFile, env: {PROBE_PROJECT: project}});
  assert.equal(absolute.exitCode, 0);
  assert.equal(absolute.output, 'fixture found\n');
  console.log(JSON.stringify({relative: {...relative, output: relative.output.replaceAll(scratch, '<scratch>')}, summary: relativeRun.error, absolute}, null, 2));
  assert.equal(relative.exitCode, 0, 'project-relative fixture should be readable');
} finally {
  process.chdir(checkout);
  await rm(scratch, {recursive: true, force: true});
}
