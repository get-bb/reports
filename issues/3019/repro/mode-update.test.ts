import { describe, expect, it } from "vitest";
import type { ProviderRuntimeEvent } from "@bb/provider-bridge-protocol/bridge-kit";
import { ACP_UPDATE_METHOD } from "./bridge-protocol.js";
import { createAcpDeltaTranslator } from "./delta-translation.js";

describe("ACP session mode reproduction", () => {
  it("translates a current plan mode update", () => {
    const translator = createAcpDeltaTranslator({ cwd: "/workspace" });
    const event: ProviderRuntimeEvent = {
      jsonrpc: "2.0",
      method: ACP_UPDATE_METHOD,
      params: {
        threadId: "thread-repro",
        update: {
          sessionUpdate: "current_mode_update",
          currentModeId: "plan",
        },
      },
    };

    const deltas = translator.translateAcpEvent(event, {
      threadId: "thread-repro",
    });

    expect(deltas).not.toEqual([]);
  });
});
