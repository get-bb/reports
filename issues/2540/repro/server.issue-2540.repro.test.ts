import { describe, expect, it } from "vitest";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import plugin from "./server";

describe("issue #2540 reproduction", () => {
  it("reports an extraRepos entry that the plugin cannot use", async () => {
    const { bb, harness } = createFakePluginHost({
      pluginId: "github",
      settings: { extraRepos: "MPIV-AI/*" },
      sdk: { projects: { list: async () => [] } },
    });
    await plugin(bb);

    const result = await harness.runCli(["repos"]);
    const warnings = harness.logEntries.filter(
      (entry) => entry.level === "warn",
    );
    console.log("OBSERVED", JSON.stringify({ result, warnings }));

    const diagnostics = [
      result.stderr,
      ...warnings.map((entry) => entry.message),
    ].join("\n");
    expect(diagnostics).toContain("MPIV-AI/*");
  });
});
