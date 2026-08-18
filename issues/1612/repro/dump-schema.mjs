// Dumps the JSON Schema that bb's plugin-api produces for the two workflow tools
// (same call as apps/server/src/services/plugins/plugin-api.ts: z.toJSONSchema(params, { io: "input" })).
// Run from plugins/workflows: node /tmp/bb-reports/issues/1612/repro/dump-schema.mjs
import { z } from "zod";
const runInputSchema = z.object({
  args: z.json().describe("...").default(null),
}).strict();
const resultInputSchema = z.object({ value: z.json() }).strict();
for (const [name, schema] of [["bb_workflow_run(args only)", runInputSchema], ["bb_workflow_result", resultInputSchema]]) {
  const json = z.toJSONSchema(schema, { io: "input" });
  console.log(`--- ${name}`);
  console.log(JSON.stringify(json, null, 2));
  const text = JSON.stringify(json);
  console.log(`contains $ref: ${text.includes('"$ref"')}, contains $defs: ${text.includes('"$defs"')}`);
}
