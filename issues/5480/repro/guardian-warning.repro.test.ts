import { describe, expect, it } from "vitest";
import { experimental_createDeltaAssembler as createDeltaAssembler } from "@get-bb/plugin-sdk/provider-bridge/testing";
import { createCodexEventTranslator } from "./translator.js";

describe("automatic review notification reproduction", () => {
  it("keeps review messages out of the unsupported-event fallback", () => {
    const translator = createCodexEventTranslator({
      additionalWorkspaceWriteRoots: [],
    });
    const assembler = createDeltaAssembler({
      providerId: "codex",
      entropyPrefix: "review-repro",
      textDeltaFlushMs: 0,
    });
    const events = ["First synthetic review result", "Second synthetic review result"]
      .flatMap((message) => assembler.assemble({
        threadId: "synthetic-bb-thread",
        deltas: translator.translateEvent({
          jsonrpc: "2.0",
          method: "guardianWarning",
          params: { threadId: "synthetic-codex-thread", message },
        }),
      }));
    console.log("Observed normalized events:", JSON.stringify(events, null, 2));
    expect(events.filter((event) => event.type === "provider/unhandled")).toEqual([]);
  });
});
