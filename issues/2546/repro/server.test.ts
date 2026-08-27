import { it } from "vitest";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import plugin from "./server";

it("loads", async () => {
  const { bb } = createFakePluginHost({ pluginId: "probe" });
  await plugin(bb);
});
