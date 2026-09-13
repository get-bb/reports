import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(process.argv[2]);
const domain = readFileSync(resolve(root, 'packages/domain/src/shared-types.ts'), 'utf8');
const declaration = domain.match(/export const reasoningLevelValues = \[[\s\S]*?\] as const;/)?.[0];
assert.ok(declaration);
const source = readFileSync(resolve(root, 'packages/provider-bridge-acp/src/bridge/model-catalog.ts'), 'utf8');
assert.ok(source.includes('import { reasoningLevelValues } from "@bb/domain";'));
const executable = stripTypeScriptTypes(source.replace('import { reasoningLevelValues } from "@bb/domain";', declaration));
const catalog = await import('data:text/javascript;base64,' + Buffer.from(executable).toString('base64'));
const levels = await import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(declaration)).toString('base64'));
const option = values => ({id:'effort', category:'thought_level', type:'select', name:'Effort', currentValue:values[0], options:values.map(value => ({value, name:value}))});
const mixed = option(['none', 'thinking']);
const custom = option(['thinking']);
const standard = option(['low', 'medium', 'high']);
const results = {
 mixed:catalog.buildAcpNativeReasoningSupport(mixed),
 customOnly:catalog.buildAcpNativeReasoningSupport(custom),
 standard:catalog.buildAcpNativeReasoningSupport(standard),
 reverse:levels.reasoningLevelValues.map(level => ({level, value:catalog.acpNativeReasoningLevelToValue(level,custom) ?? null}))
};
console.log(JSON.stringify(results,null,2));
assert.equal(results.standard.supportedReasoningEfforts.length,3);
assert.equal(results.mixed.supportedReasoningEfforts.length,2,'both advertised choices must survive catalog construction');
assert.equal(results.customOnly.supportedReasoningEfforts.length,1,'custom-only choice must survive');
assert.ok(results.reverse.some(entry => entry.value === 'thinking'));
