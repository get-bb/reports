import { getEventListeners } from "node:events";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import { expect, it } from "vitest";
import { migrations } from "./data.js";
import { createWorkflowService } from "./service.js";

it("does not retain abort listeners from completed worker polls", async () => {
  const { bb, harness } = createFakePluginHost({ pluginId: "workflows" });
  const db = bb.storage.database();
  bb.storage.migrate(db, migrations);
  const service = createWorkflowService(bb, db);
  const controller = new AbortController();
  const worker = service.runWorker(controller.signal);

  await new Promise((resolve) => setTimeout(resolve, 800));
  const listenerCount = getEventListeners(controller.signal, "abort").length;

  controller.abort();
  await worker;
  await harness.dispose();

  expect(listenerCount).toBeLessThanOrEqual(2);
});
