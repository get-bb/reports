import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { fetchChatGpt } from "./chatgpt-fetch.js";

const PROXY_ENV_KEYS = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "no_proxy",
] as const;

const originalEnv = new Map(
  PROXY_ENV_KEYS.map((key) => [key, process.env[key]] as const),
);
const servers: Server[] = [];

async function listen(server: Server): Promise<number> {
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected a TCP listener");
  }
  return address.port;
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

afterEach(async () => {
  for (const server of servers.splice(0)) {
    if (server.listening) await close(server);
  }
  for (const key of PROXY_ENV_KEYS) {
    const value = originalEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("fetchChatGpt proxy environment", () => {
  it("routes outbound HTTP through HTTP_PROXY", async () => {
    const origin = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("direct-origin-response");
    });
    const originPort = await listen(origin);

    const proxyReservation = createServer();
    const proxyPort = await listen(proxyReservation);
    await close(proxyReservation);

    const proxyUrl = `http://127.0.0.1:${proxyPort}`;
    process.env.HTTP_PROXY = proxyUrl;
    process.env.HTTPS_PROXY = proxyUrl;
    process.env.http_proxy = proxyUrl;
    process.env.https_proxy = proxyUrl;
    process.env.NO_PROXY = "";
    process.env.no_proxy = "";

    await expect(
      fetchChatGpt({
        url: `http://127.0.0.1:${originPort}/usage`,
        init: (headers) => ({ headers }),
      }),
    ).rejects.toMatchObject({ cause: { code: "ECONNREFUSED" } });
  });
});
