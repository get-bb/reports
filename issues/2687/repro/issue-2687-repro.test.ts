import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";

import {
  describeUnreachableServer,
  fetchPluginCliContributions,
} from "../plugin-cli-proxy.js";

describe("plugin command discovery timeout", () => {
  it("does not send a plugin command request", async () => {
    const requests: Array<{ method: string | undefined; url: string | undefined }> = [];
    const server = createServer((request) => {
      requests.push({ method: request.method, url: request.url });
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const { port } = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const result = await fetchPluginCliContributions(baseUrl, 20, {
        sleep: async () => undefined,
      });

      expect(result.outcome).toBe("unreachable");
      if (result.outcome !== "unreachable") return;
      expect(
        describeUnreachableServer(
          baseUrl,
          result.cause,
          result.lastTimeoutMs,
          result.attempts,
        ),
      ).toContain("your command did not run");
      expect(requests).toEqual([
        { method: "GET", url: "/api/v1/plugins/contributions" },
        { method: "GET", url: "/api/v1/plugins/contributions" },
        { method: "GET", url: "/api/v1/plugins/contributions" },
      ]);
      expect(requests.some((request) => request.url?.endsWith("/cli"))).toBe(
        false,
      );
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  });
});
