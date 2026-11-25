import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { expect, it } from "vitest";
import { ParentAvailability } from "./parent-pool.js";

it.each(["timeout", "503"])(
  "keeps a successful parent capability after a transient %s",
  async (failure) => {
    let requests = 0;
    let clock = 0;
    const errors: string[] = [];
    const server = createServer(async (_request, response) => {
      requests += 1;
      if (requests === 2) {
        if (failure === "timeout") await delay(2_500);
        else {
          response.writeHead(503).end();
          return;
        }
      }
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ claude: true, codex: false }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Expected an ephemeral TCP listener");
    }
    const client = new ParentAvailability({
      parent: {
        baseUrl: `http://127.0.0.1:${address.port}`,
        token: "EXAMPLE",
      },
      fetch,
      now: () => clock,
      onError: (error) => errors.push(String(error)),
    });
    const observations: Array<{
      clock: number;
      claude: boolean;
      requests: number;
    }> = [];
    try {
      for (const instant of [0, 30_001, 31_001, 60_000, 60_001]) {
        clock = instant;
        const result = await client.get();
        observations.push({ clock, claude: result.claude, requests });
      }
      console.log(JSON.stringify({ failure, observations, errors }));
      expect(observations[0]?.claude).toBe(true);
      expect(observations[4]?.claude).toBe(true);
      expect(errors).toHaveLength(1);
      expect(observations[1]?.claude).toBe(true);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  },
);
