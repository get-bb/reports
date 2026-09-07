import { createProviderRegistryService } from "../../src/services/providers/provider-registry.js";
import { registerFirstPartyProviders } from "../helpers/provider-registry.js";
import { withTestHarness } from "../helpers/test-app.js";
import { expect, it } from "vitest";

it("waits for provider registrations before listing projects without stored defaults", async () => {
  await withTestHarness(
    { seedFirstPartyProviders: false },
    async (harness) => {
      const registry = createProviderRegistryService({
        deferRegistrationsSettled: true,
      });
      harness.deps.providerRegistry = registry;

      const responsesPromise = Promise.all([
        harness.app.request("/api/v1/sidebar-bootstrap"),
        harness.app.request(
          "/api/v1/projects?include=threads&includePersonal=true",
        ),
      ]);
      const earlyResult = await Promise.race([
        responsesPromise.then((responses) =>
          responses.map((response) => response.status),
        ),
        new Promise<"pending">((resolve) =>
          setTimeout(() => resolve("pending"), 20),
        ),
      ]);

      await registerFirstPartyProviders(registry);
      registry.markRegistrationsSettled();
      const firstStatuses =
        earlyResult === "pending"
          ? (await responsesPromise).map((response) => response.status)
          : earlyResult;
      const settledResponses = await Promise.all([
        harness.app.request("/api/v1/sidebar-bootstrap"),
        harness.app.request(
          "/api/v1/projects?include=threads&includePersonal=true",
        ),
      ]);

      expect({
        beforeSettled: earlyResult,
        firstStatuses,
        afterSettled: settledResponses.map((response) => response.status),
      }).toEqual({
        beforeSettled: "pending",
        firstStatuses: [200, 200],
        afterSettled: [200, 200],
      });
    },
  );
});
