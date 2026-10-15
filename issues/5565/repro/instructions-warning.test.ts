import { expect, it } from "vitest";
import type { PluginAgentConfigurationContext } from "../../backend-contract.js";
import { createFakePluginHost, makePluginAgentConfigurationContext } from "../index.js";

const configurationContext = makePluginAgentConfigurationContext();

it("resolves conditional tools, skills, context, and capped instructions without rebuilding registrations", async () => {
  const { bb, harness } = createFakePluginHost({
    pluginId: "conditional",
    agentSkillIds: ["alpha-skill", "beta-skill"],
  });
  for (const name of ["alpha_tool", "beta_tool"]) {
    bb.agents.registerTool({
      name,
      description: name,
      parameters: { type: "object" },
      execute: () => name,
    });
  }
  const contexts: PluginAgentConfigurationContext[] = [];
  bb.agents.configure((context) => {
    contexts.push(context);
    const alpha = context.host.id === "host-test";
    return {
      tools: [alpha ? "alpha_tool" : "beta_tool"],
      skills: [alpha ? "alpha-skill" : "beta-skill"],
      instructions:
        `${context.provider.id}:${context.provider.model}:`.padEnd(5000, "x"),
    };
  });

  const alpha = await harness.resolveAgentConfiguration(configurationContext);
  const betaContext = makePluginAgentConfigurationContext({
    thread: { id: "thread-beta" },
    host: { id: "host-beta", name: "Beta host" },
    provider: {
      id: "claude-code",
      model: "claude-opus",
    },
  });
  const beta = await harness.resolveAgentConfiguration(betaContext);

  expect(alpha.tools.map((tool) => tool.name)).toEqual(["alpha_tool"]);
  expect(alpha.skills).toEqual(["alpha-skill"]);
  expect(alpha.instructions).toHaveLength(4096);
  expect(harness.logEntries).toEqual([
    {
      level: "warn",
      message: expect.stringContaining(
        "configure() output.instructions truncated from 5000 to 4096 characters",
      ),
    },
    {
      level: "warn",
      message: expect.stringContaining(
        "configure() output.instructions truncated from 5000 to 4096 characters",
      ),
    },
  ]);
  expect(beta.tools.map((tool) => tool.name)).toEqual(["beta_tool"]);
  expect(beta.skills).toEqual(["beta-skill"]);
  expect(contexts).toEqual([configurationContext, betaContext]);
  expect(harness.registrations.agentTools.map((tool) => tool.name)).toEqual([
    "alpha_tool",
    "beta_tool",
  ]);
});


