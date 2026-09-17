import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import { expect, it } from "vitest";
import plugin from "./server.js";

it("exposes JSON value type constraints to provider schema consumers", async () => {
  const { bb, harness } = createFakePluginHost({
    pluginId: "workflows",
    agentSkillIds: ["workflows"],
  });
  try {
    await plugin(bb);
    const failures: string[] = [];
    for (const [name, property] of [
      ["bb_workflow_run", "args"],
      ["bb_workflow_result", "value"],
    ]) {
      const tool = harness.registrations.agentTools.find((entry) => entry.name === name);
      expect(tool).toBeDefined();
      const schema = tool!.inputSchema;
      if (typeof schema !== "object" || schema === null || !("properties" in schema)) {
        throw new Error("Missing object properties");
      }
      const properties = schema.properties;
      if (typeof properties !== "object" || properties === null || Array.isArray(properties)) {
        throw new Error("Invalid properties");
      }
      const node = Reflect.get(properties, property);
      console.log(JSON.stringify({ tool: name, property, node }));
      if (!node || !("type" in node || "anyOf" in node || "oneOf" in node || "allOf" in node || "$ref" in node)) {
        failures.push(`${name}.${property}`);
      }
    }
    expect(failures, "Provider-facing parameters missing JSON type constraints").toEqual([]);
  } finally {
    await harness.dispose();
  }
});
