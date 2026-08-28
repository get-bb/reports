import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import memoryPlugin from "./server.ts";
import docsPlugin from "../docs/server.ts";

const memoryHost = createFakePluginHost({ pluginId: "memory" });
await memoryPlugin(memoryHost.bb);

const docsHost = createFakePluginHost({ pluginId: "docs" });
await docsPlugin(docsHost.bb);

console.log(
  JSON.stringify(
    {
      memory: await memoryHost.harness.runCli(["update", "--help"]),
      docs: await docsHost.harness.runCli(["status", "--help"]),
    },
    null,
    2,
  ),
);
