import { expect, it, vi } from "vitest";
import {
  createFakePluginHost,
  makeHostResponse,
} from "@get-bb/plugin-sdk/testing";
import plugin from "./server.js";
import { usageListMethod, usageFetchMethod } from "./usage-source-contract.js";

it.each([{ machineIds: null }, { machineIds: ["host"] }])(
  "resolves resource metadata without native usage support for $machineIds",
  async ({ machineIds }) => {
    const host = createFakePluginHost({
      pluginId: "provider-usage",
      sdk: {
        system: { config: async () => ({ primaryHostId: null }) },
        hosts: {
          list: async () => [
            makeHostResponse({ id: "host", status: "connected" }),
          ],
        },
        providers: {
          list: async (input) =>
            input?.capability === "usage" ||
            (machineIds !== null && input?.hostId !== "host")
              ? []
              : [
                  {
                    id: "external-agent",
                    displayName: "External Agent",
                    logoUrl: "/external-agent.svg",
                    icon: { glyph: "external/agent" },
                  },
                  {
                    id: "unused-agent",
                    displayName: "Unused Agent",
                    logoUrl: null,
                  },
                ],
        },
        plugins: {
          experimental_discoverRpc: async () => [
            {
              pluginId: "quota",
              displayName: "Quota",
              method: usageListMethod,
            },
          ],
          callRpc: async () => ({
            resources: [
              {
                id: "account",
                providerId: "external-agent",
                scope: { kind: "host", hostId: "host", hostName: "Host" },
              },
            ],
          }),
        },
      },
    });
    plugin(host.bb);
    try {
      const snapshot = await host.harness.behavior.callRpc("getUsage", {
        force: false,
        machineIds,
        providerIds: [],
        maxAgeMs: 0,
      });
      expect(snapshot).toMatchObject({
        machines: [
          {
            providers: [
              {
                providerId: "external-agent",
                displayName: "External Agent",
                logoUrl: "/external-agent.svg",
                icon: { glyph: "external/agent" },
              },
            ],
          },
        ],
      });
    } finally {
      await host.harness.lifecycle.dispose();
    }
  },
);
