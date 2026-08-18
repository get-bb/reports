// Dumps the workflows plugin's registered agent-tool schemas (as the server
// would send them to a provider) to $OUT. Place in plugins/workflows/ and run:
//   OUT=/tmp/tools.json pnpm exec vitest run dump-tool-schemas.test.ts
import { it } from "vitest";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import plugin from "./src/server.js";
import { writeFileSync } from "node:fs";
it("dump", async () => {
  const { bb, harness } = createFakePluginHost({ pluginId: "workflows", agentSkillIds: ["workflows"] });
  await plugin(bb);
  const out = harness.registrations.agentTools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
  writeFileSync(process.env.OUT!, JSON.stringify(out, null, 2));
  await harness.dispose();
});
