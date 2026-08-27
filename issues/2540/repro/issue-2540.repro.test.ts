import { describe, expect, it } from "vitest";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import plugin from "./server";

describe("issue 2540: invalid extraRepos diagnostics", () => {
  it("reports an invalid entry while it keeps a valid sibling", async () => {
    const { bb, harness } = createFakePluginHost({
      pluginId: "github",
      settings: { extraRepos: "acme/widgets, ACME/*" },
      sdk: { projects: { list: async () => [] } },
    });

    await plugin(bb);
    const result = await harness.runCli(["repos"]);

    console.info(JSON.stringify({ result, logEntries: harness.logEntries }, null, 2));
    expect(result.stdout).toBe("acme/widgets");
    expect(harness.logEntries).toContainEqual(
      expect.objectContaining({
        level: "warn",
        message: expect.stringMatching(/extraRepos.*ACME\/\*/i),
      }),
    );
  });
});
