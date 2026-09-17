import { describe, expect, it } from "vitest";
import { createBridgeProtocolAdapter } from "./bridge-protocol-adapter.js";

function adapter() {
  return createBridgeProtocolAdapter({
    id: "repro",
    capabilities: {
      supportsThreadArchive: false,
      supportsThreadRename: false,
      supportsServiceTier: false,
      fork: "none",
      permissionModes: ["full"],
    },
    process: { command: "node", args: [] },
  });
}

function feed(bridge: ReturnType<typeof adapter>, deltas: unknown[]) {
  return bridge.translateEvent({
    jsonrpc: "2.0",
    method: "thread/delta",
    params: { threadId: "t_repro", deltas },
  });
}

describe("issue 3820 reproduction", () => {
  it("valid completion survives alone but disappears beside an invalid delta", () => {
    const bridge = adapter();
    expect(feed(bridge, [{ kind: "turn.open" }]).map((event) => event.type)).toContain("turn/started");
    expect(feed(bridge, [
      { kind: "contextWindow", used: "invalid", size: 1000 },
      { kind: "turn.boundary", status: "completed" },
    ])).toEqual([]);
    expect(feed(bridge, [{ kind: "turn.boundary", status: "completed" }]).map((event) => event.type)).toContain("turn/completed");
    console.log("Mixed batch: 0 events; isolated boundary: turn/completed");
  });

  it("requires an outer protocol version and selected-only model array", () => {
    const bridge = adapter();
    const request = bridge.buildPostInitializeRequests()[0];
    expect(() => request?.onResult({ grammarVersions: [3, 3], sessionRestore: false })).toThrow(/protocolVersion/);
    expect(() => request?.onResult({ protocolVersion: 2, capabilities: { grammarVersions: [3, 3] } })).not.toThrow();
    expect(() => bridge.parseModelListResult({ models: [] })).toThrow(/selectedOnlyModels/);
    expect(bridge.parseModelListResult({ models: [], selectedOnlyModels: [] })).toEqual({ models: [], selectedOnlyModels: [] });
    console.log("Flat initialize rejected; wrapped initialize accepted; omitted selectedOnlyModels rejected");
  });
});
