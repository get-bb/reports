import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { discoverProviderCommands, discoverSkills, type CommandScanRoot } from './src/command-discovery.ts';

const fixture = await mkdtemp(path.join(tmpdir(), 'skill-scan-4013-'));
try {
  const rootPath = path.join(fixture, 'user-skills');
  const target = path.join(fixture, 'installed');
  await mkdir(rootPath);
  await mkdir(target);
  await writeFile(path.join(target, 'SKILL.md'), '---\nname: linked-directory\ndescription: fixture\n---\nFixture skill.\n');
  await symlink(target, path.join(rootPath, 'linked-directory'), 'dir');
  await mkdir(path.join(rootPath, 'linked-file'));
  await symlink(path.join(target, 'SKILL.md'), path.join(rootPath, 'linked-file', 'SKILL.md'));
  await mkdir(path.join(rootPath, 'ordinary'));
  await writeFile(path.join(rootPath, 'ordinary', 'SKILL.md'), '---\nname: ordinary\n---\nFixture skill.\n');
  const scan = async (shape: 'skill' | 'skill-recursive') => {
    const root: CommandScanRoot = { rootPath, shape, source: 'skill', origin: 'user', namePrefix: '' };
    const commands = await discoverProviderCommands({ roots: [root] });
    const skills = await discoverSkills({ roots: [{ ...root, identitySeed: 'fixture', rootKind: 'provider-user' }] });
    return { commands: commands.map(x => x.name).sort(), skills: skills.map(x => ({ name: x.name, linked: x.linked })).sort((a, b) => a.name.localeCompare(b.name)) };
  };
  const flat = await scan('skill');
  const recursive = await scan('skill-recursive');
  console.log(JSON.stringify({ flat, recursive }, null, 2));
  assert.deepEqual(flat.commands, ['linked-directory', 'linked-file', 'ordinary']);
  assert.ok(recursive.commands.includes('ordinary'));
  assert.deepEqual(recursive.commands, flat.commands, 'Recursive user scan must retain linked skill entries');
} finally {
  await rm(fixture, { recursive: true, force: true });
}
