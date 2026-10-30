import { expect, it } from "vitest";
import { registerHostRpcResponder } from "../helpers/host-rpc.js";
import { seedHostSession } from "../helpers/seed.js";
import { withTestHarness } from "../helpers/test-app.js";

it("shares a usage failure across sequential non-refresh readers", async () => {
  await withTestHarness(async (harness) => {
    const { host, session } = seedHostSession(harness.deps, {
      id: "throttled-usage",
    });
    let probes = 0;
    const responder = registerHostRpcResponder(harness, {
      hostId: host.id,
      sessionId: session.id,
      handle(request) {
        if (request.command.type === "provider.usage") {
          probes += 1;
          return {
            ok: true,
            result: {
              supported: true,
              usage: {
                status: "error",
                message: "synthetic throttling",
                accountEmail: null,
                planLabel: null,
              },
            },
          };
        }
        if (request.command.type === "provider.health") {
          return {
            ok: true,
            result: {
              supported: true,
              health: {
                status: "not_installed",
                statusMessage: null,
                accountEmail: null,
                planLabel: null,
                installedVersion: null,
                minimumSupportedVersion: null,
                canInstall: false,
                canUpdate: false,
                loginCommand: null,
              },
            },
          };
        }
        throw new Error(`Unexpected command ${request.command.type}`);
      },
    });
    try {
      const url = `/api/v1/system/usage-limits?hostId=${host.id}&providerId=claude-code`;
      const first = await harness.app.request(url);
      const second = await harness.app.request(url);
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      console.log(
        "server readers",
        JSON.stringify({
          first: await first.json(),
          second: await second.json(),
          probes,
        }),
      );
      expect(probes).toBe(1);
    } finally {
      responder.unregister();
    }
  });
});
