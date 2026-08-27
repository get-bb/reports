import { describe, expect, it } from "vitest";
import { registerHostRpcResponder } from "../helpers/host-rpc.js";
import { readJson } from "../helpers/json.js";
import { seedHostSession } from "../helpers/seed.js";
import { withTestHarness } from "../helpers/test-app.js";

describe("issue 2362 HTTP mapping", () => {
  it("returns the daemon error message in a 502 response", async () => {
    await withTestHarness(async (harness) => {
      const { host, session } = seedHostSession(harness.deps);
      registerHostRpcResponder(harness, {
        hostId: host.id,
        sessionId: session.id,
        handle: () => ({
          ok: false,
          errorCode: "command_failed",
          errorMessage: "Maximum call stack size exceeded",
        }),
      });

      const response = await harness.app.request("/api/v1/files/paths", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          hostId: host.id,
          path: "/large-tree",
          includeFiles: true,
          includeDirectories: false,
        }),
      });

      expect(response.status).toBe(502);
      expect(await readJson(response)).toEqual({
        code: "command_failed",
        message: "Maximum call stack size exceeded",
        retryable: false,
      });
    });
  });
});
