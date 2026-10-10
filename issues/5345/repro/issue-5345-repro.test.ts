import { describe, expect, it } from "vitest";
import { systemProviderInfoSchema } from "@bb/server-contract";
import { registerHostRpcResponder } from "../helpers/host-rpc.js";
import { seedHostSession, seedPrimaryHost } from "../helpers/seed.js";
import { withTestHarness } from "../helpers/test-app.js";

describe("issue 5345: discovery before a target machine exists", () => {
  it("cannot offer an installed-only target agent with the unscoped new-machine query", async () => {
    await withTestHarness({}, async (harness) => {
      const primary = seedHostSession(harness.deps, { id: "repro-primary" });
      seedPrimaryHost(harness.deps, primary.host.id);
      const registration = harness.deps.providerRegistry.get("acp-omp");
      expect(registration?.visibility).toBe("installed");

      const registerHealth = (
        machine: ReturnType<typeof seedHostSession>,
        hasAgent: boolean,
      ) => {
        registerHostRpcResponder(harness, {
          hostId: machine.host.id,
          sessionId: machine.session.id,
          handle: (request) => {
            if (request.command.type !== "provider.health") {
              throw new Error(`Unexpected command ${request.command.type}`);
            }
            const installed =
              hasAgent && request.command.providerId === "acp-omp";
            return {
              ok: true,
              result: {
                supported: true,
                health: {
                  status: installed ? "ready" : "not_installed",
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
          },
        });
      };
      registerHealth(primary, false);

      const list = async (query: string) => {
        const response = await harness.app.request(
          `/api/v1/system/providers${query}`,
        );
        expect(response.status).toBe(200);
        return systemProviderInfoSchema
          .array()
          .parse(await response.json())
          .map((provider) => provider.id);
      };
      const unscoped = await list("");
      const primaryScoped = await list("?hostId=repro-primary");
      const target = seedHostSession(harness.deps, { id: "repro-created-target" });
      registerHealth(target, true);
      const targetScoped = await list("?hostId=repro-created-target");
      console.log(
        JSON.stringify({ unscoped, primaryScoped, targetScoped }, null, 2),
      );

      expect(primaryScoped).not.toContain("acp-omp");
      expect(targetScoped).toContain("acp-omp");
      expect(unscoped).toContain("acp-omp");
    });
  });
});
