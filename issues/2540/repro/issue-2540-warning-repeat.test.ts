import { expect, it } from "vitest";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import plugin from "./server";

it("does not repeat the same extraRepos warning on each discovery", async () => {
  const { bb, harness } = createFakePluginHost({
    pluginId: "github",
    settings: { extraRepos: "ACME/*" },
    sdk: { projects: { list: async () => [] } },
  });
  await plugin(bb);

  await harness.runCli(["repos"]);
  await harness.runCli(["repos"]);

  const warnings = harness.logEntries.filter(
    (entry) => entry.level === "warn" && entry.message.includes("ACME/*"),
  );
  console.info(JSON.stringify(warnings, null, 2));
  expect(warnings).toHaveLength(1);
});
