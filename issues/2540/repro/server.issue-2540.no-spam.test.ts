import { describe, expect, it } from "vitest";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import plugin from "./server";

describe("issue #2540 pull request review", () => {
  it("does not repeat the same warning on each repository discovery", async () => {
    const { bb, harness } = createFakePluginHost({
      pluginId: "github",
      settings: { extraRepos: "MPIV-AI/*" },
      sdk: { projects: { list: async () => [] } },
    });
    await plugin(bb);

    await harness.runCli(["repos"]);
    await harness.runCli(["repos"]);

    const warnings = harness.logEntries.filter(
      (entry) =>
        entry.level === "warn" && entry.message.includes("MPIV-AI/*"),
    );
    console.log("OBSERVED", JSON.stringify({ warningCount: warnings.length }));
    expect(warnings).toHaveLength(1);
  });
});
