import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const source = resolve(process.argv[2], "plugins/ask-user-question/src/tool-definition.ts");
const { TOOL_DESCRIPTION } = await import(pathToFileURL(source).href);
const references = TOOL_DESCRIPTION.match(/EnterPlanMode|ExitPlanMode/g) ?? [];
console.log(JSON.stringify({ planToolReferences: references }));
assert.deepEqual(references, [], "Shared question guidance must not prescribe provider-specific plan tools");
