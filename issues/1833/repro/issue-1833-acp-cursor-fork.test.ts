import { describe, expect, it } from "vitest";
import { listSystemProviderInfos } from "../../../src/services/system/execution-options.js";
import { withTestHarness } from "../../helpers/test-app.js";

/**
 * Repro for get-bb/bb#1833.
 *
 * cursor-agent's ACP `initialize` result (cursor-agent 2026.08.11) advertises
 * `sessionCapabilities: { list: {} }` and no `fork`, so the ACP bridge refuses
 * every `thread/fork` for it ("does not advertise session/fork support").
 * The server-side declaration in plugins/provider-acp/server.ts nevertheless
 * says `fork: "tip"`, so the registry, `POST /threads/fork` and the app all
 * offer fork for acp-cursor, and every fork births an errored thread.
 *
 * On c7c66423d the two assertions below FAIL (supportsFork is `true`).
 * They pass once the acp-cursor declaration says `fork: "none"` (or the
 * capability is otherwise derived from what the agent actually advertises).
 */
describe("issue #1833: acp-cursor fork capability", () => {
  it("does not advertise fork for acp-cursor", async () => {
    await withTestHarness(
      { seedFirstPartyProviders: false },
      async (harness) => {
        const entry = await harness.pluginService.install(
          "builtin:provider-acp",
          { kind: "root" },
        );
        expect(entry.status, entry.statusDetail ?? "").toBe("running");
        const registry = harness.deps.providerRegistry;

        // Server-side gate used by POST /api/v1/threads/fork.
        expect(registry.supportsFork("acp-cursor")).toBe(false);

        // Client-facing ProviderInfo used by the app's fork affordance.
        const infos = await listSystemProviderInfos(harness.deps, {});
        const cursor = infos.find((info) => info.id === "acp-cursor");
        expect(cursor?.capabilities.supportsFork).toBe(false);
      },
    );
  }, 60_000);
});
